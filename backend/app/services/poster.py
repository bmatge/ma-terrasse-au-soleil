"""Generate A4 landscape PNG poster showing annual sunshine for a terrace.

Produces a high-resolution image (300 DPI) with:
- Left sidebar: establishment info, terrace details, legend
- Main chart: annual sunshine calendar (months x hours)
- QR code linking to the terrace page on ausoleil.app
"""

import io
import math
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import matplotlib.patches as mpatches  # noqa: E402
import matplotlib.patheffects as pe  # noqa: E402
import numpy as np  # noqa: E402
import qrcode  # noqa: E402
from PIL import Image  # noqa: E402

from app.services.sun import get_sun_position  # noqa: E402

PARIS_TZ = ZoneInfo("Europe/Paris")
PARIS_LAT, PARIS_LON = 48.8566, 2.3522
ASSETS_DIR = Path(__file__).parent.parent / "assets"

# --- Brand colours ---
AMBER = "#F59E0B"
AMBER_DARK = "#D97706"
AMBER_DARKER = "#B45309"
SUNSHINE = "#FBCF3B"
SHADOW = "#F5D89A"
SKY_BLUE_DASHED = "#60BFEA"
NIGHT_COLOR = "#CBD5E1"
WHITE = "#FFFFFF"
SIDEBAR_BG = "#F59E0B"

# --- Layout ---
FIG_W_MM, FIG_H_MM = 297, 210
FIG_W_IN = FIG_W_MM / 25.4
FIG_H_IN = FIG_H_MM / 25.4
DPI = 300
SIDEBAR_FRAC = 0.22

# --- Computation ---
STEP_MINUTES = 10
MONTH_NAMES_FR = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
    "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
]


def generate_poster(
    name: str,
    address: str,
    lat: float,
    lon: float,
    profile: list[float],
    year: int,
    qr_url: str,
    surface_m2: float | None = None,
) -> bytes:
    """Generate the sunshine poster and return PNG bytes."""
    grid, hours, day_summaries = _compute_sunshine_grid(profile, year)

    fig = plt.figure(figsize=(FIG_W_IN, FIG_H_IN), dpi=DPI, facecolor=WHITE)

    # Axes: sidebar (left) and chart (right)
    ax_side = fig.add_axes([0, 0, SIDEBAR_FRAC, 1], facecolor=SIDEBAR_BG)
    chart_left = SIDEBAR_FRAC + 0.04
    ax_chart = fig.add_axes(
        [chart_left, 0.10, 1 - chart_left - 0.02, 0.82],
        facecolor=WHITE,
    )

    orientation_az, orientation_label = _compute_orientation(profile)
    _draw_sidebar(fig, ax_side, name, address, year, surface_m2, orientation_label)
    _draw_chart(ax_chart, grid, hours, day_summaries)
    _draw_annotations(ax_chart, day_summaries)
    _draw_qr(fig, qr_url)
    _draw_footer(fig)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=DPI, facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Annual sunshine computation
# ---------------------------------------------------------------------------

_sun_cache: dict[int, list[list[tuple[float, float, int]]]] = {}


def _get_sun_positions(year: int, day_step: int = 3) -> list[list[tuple[float, float, int]]]:
    """Precompute sun (altitude, azimuth_index, hour_frac) for sampled days.

    Cached per year so the expensive pysolar calls happen only once.
    Returns a list of (doy, positions) where positions is a list of
    (hour_frac, altitude, azimuth_index) tuples for each time step.
    """
    if year in _sun_cache:
        return _sun_cache[year]

    total_days = (date(year, 12, 31) - date(year, 1, 1)).days + 1
    all_days: list[list[tuple[float, float, int]]] = [[] for _ in range(total_days)]

    current = date(year, 1, 1)
    end = date(year, 12, 31)
    while current <= end:
        doy = current.timetuple().tm_yday
        dt_base = datetime(current.year, current.month, current.day, tzinfo=PARIS_TZ)
        positions = []
        for minutes in range(4 * 60, 22 * 60 + 1, STEP_MINUTES):
            dt = dt_base + timedelta(minutes=minutes)
            alt, azi = get_sun_position(PARIS_LAT, PARIS_LON, dt)
            if alt > 0:
                positions.append((minutes / 60.0, alt, int(round(azi)) % 360))
        all_days[doy - 1] = positions
        current += timedelta(days=day_step)

    # Always include Dec 31
    last_doy = total_days
    if not all_days[last_doy - 1]:
        dt_base = datetime(year, 12, 31, tzinfo=PARIS_TZ)
        positions = []
        for minutes in range(4 * 60, 22 * 60 + 1, STEP_MINUTES):
            dt = dt_base + timedelta(minutes=minutes)
            alt, azi = get_sun_position(PARIS_LAT, PARIS_LON, dt)
            if alt > 0:
                positions.append((minutes / 60.0, alt, int(round(azi)) % 360))
        all_days[last_doy - 1] = positions

    # Interpolate empty days by copying nearest sampled day
    last_filled = 0
    for i in range(total_days):
        if all_days[i]:
            last_filled = i
        else:
            all_days[i] = all_days[last_filled]

    _sun_cache[year] = all_days
    return all_days


def _compute_sunshine_grid(
    profile: list[float], year: int,
) -> tuple[np.ndarray, list[float], list[dict]]:
    """Build a 2D grid of sunshine status and per-day summaries.

    Returns:
        grid: (n_steps, n_days) array — 0=night, 1=shadow, 2=sunny
        hours: list of fractional hours for each row
        summaries: per-day dicts with sunrise/sunset/sunny_minutes
    """
    sun_positions = _get_sun_positions(year)
    total_days = len(sun_positions)

    time_minutes = list(range(4 * 60, 22 * 60 + 1, STEP_MINUTES))
    n_steps = len(time_minutes)
    hours = [m / 60.0 for m in time_minutes]

    grid = np.zeros((n_steps, total_days), dtype=np.float32)
    summaries = []

    for day_idx in range(total_days):
        # Build lookup: minutes -> (alt, az_idx)
        pos_by_min: dict[int, tuple[float, int]] = {}
        for hf, alt, az in sun_positions[day_idx]:
            pos_by_min[int(round(hf * 60))] = (alt, az)

        sunrise = sunset = None
        sunny_minutes = 0

        for step_idx, m in enumerate(time_minutes):
            entry = pos_by_min.get(m)
            if entry is not None:
                alt, az_idx = entry
                hf = m / 60.0
                if sunrise is None:
                    sunrise = hf
                sunset = hf
                if alt > profile[az_idx]:
                    grid[step_idx, day_idx] = 2.0  # sunny
                    sunny_minutes += STEP_MINUTES
                else:
                    grid[step_idx, day_idx] = 1.0  # shadow
            # else: 0 = night

        summaries.append({
            "doy": day_idx + 1,
            "sunrise": sunrise or 8.0,
            "sunset": sunset or 18.0,
            "sunny_minutes": sunny_minutes,
        })

    return grid, hours, summaries


# ---------------------------------------------------------------------------
# Orientation from horizon profile
# ---------------------------------------------------------------------------

def _compute_orientation(profile: list[float]) -> tuple[int, str]:
    """Estimate the dominant orientation from the horizon profile."""
    # Find the azimuth in the sun-relevant range (60-300) with minimum obstruction
    min_elev = float("inf")
    best_az = 180
    for az in range(60, 301):
        if profile[az] < min_elev:
            min_elev = profile[az]
            best_az = az
    return best_az, _azimuth_label(best_az)


def _azimuth_label(az: int) -> str:
    directions = [
        (0, "Nord"), (45, "Nord-Est"), (90, "Est"), (135, "Sud-Est"),
        (180, "Sud"), (225, "Sud-Ouest"), (270, "Ouest"), (315, "Nord-Ouest"),
        (360, "Nord"),
    ]
    closest = min(directions, key=lambda d: abs(d[0] - az))
    prefix = "Plein " if az % 45 == 0 else ""
    return f"{prefix}{closest[1]} ({az}\u00b0)"


# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------

def _draw_sidebar(
    fig, ax, name: str, address: str, year: int,
    surface_m2: float | None, orientation_label: str,
):
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.patch.set_visible(True)

    text_kw = dict(color=WHITE, fontfamily="sans-serif", transform=ax.transAxes)

    # Logo — radial crop + composite onto amber background
    logo_path = ASSETS_DIR / "logo.png"
    if logo_path.exists():
        logo_img = Image.open(logo_path).convert("RGBA")
        logo_img.thumbnail((400, 400))
        w, h = logo_img.size
        # Radial crop: create circular mask, shrunk by 10px to remove white edge
        mask = Image.new("L", (w, h), 0)
        from PIL import ImageDraw
        draw = ImageDraw.Draw(mask)
        margin = 10
        draw.ellipse([margin, margin, w - margin, h - margin], fill=255)
        logo_img.putalpha(mask)
        # Composite onto amber background
        bg = Image.new("RGBA", logo_img.size, (245, 158, 11, 255))
        bg.paste(logo_img, mask=logo_img)
        logo_arr = np.array(bg.convert("RGB"))
        ax_logo = fig.add_axes(
            [0.02, 0.78, SIDEBAR_FRAC - 0.04, 0.19],
            facecolor=SIDEBAR_BG,
        )
        ax_logo.imshow(logo_arr)
        ax_logo.axis("off")

    # Separator
    ax.plot([0.08, 0.92], [0.76, 0.76], color="#FFFFFF4D",
            transform=ax.transAxes, linewidth=0.8)

    # Establishment
    ax.text(0.08, 0.72, "\u00c9tablissement", fontsize=8, alpha=0.65, **text_kw)
    # Name — wrap if long
    _draw_wrapped_text(ax, 0.08, 0.67, name, fontsize=14, fontweight="bold",
                       max_chars=16, line_spacing=0.045, **text_kw)

    # Address
    name_lines = max(1, math.ceil(len(name) / 16))
    addr_y = 0.67 - name_lines * 0.045 - 0.01
    _draw_wrapped_text(ax, 0.08, addr_y, address or "", fontsize=9, alpha=0.85,
                       max_chars=22, line_spacing=0.035, **text_kw)

    # Separator
    addr_lines = max(1, math.ceil(len(address or "") / 22))
    sep_y = addr_y - addr_lines * 0.035 - 0.03
    ax.plot([0.08, 0.92], [sep_y, sep_y], color="#FFFFFF4D",
            transform=ax.transAxes, linewidth=0.8)

    # Terrace details
    details_y = sep_y - 0.035
    ax.text(0.08, details_y, "Terrasse", fontsize=8, alpha=0.65, **text_kw)

    row_y = details_y - 0.05
    _detail_row(ax, 0.08, row_y, "Orientation", orientation_label, **text_kw)
    row_y -= 0.05
    if surface_m2 is not None:
        _detail_row(ax, 0.08, row_y, "Surface", f"{surface_m2:.0f} m\u00b2", **text_kw)
        row_y -= 0.05
    _detail_row(ax, 0.08, row_y, "Donn\u00e9es", str(year), **text_kw)

    # Separator
    row_y -= 0.04
    ax.plot([0.08, 0.92], [row_y, row_y], color="#FFFFFF4D",
            transform=ax.transAxes, linewidth=0.8)

    # Legend
    legend_y = row_y - 0.035
    ax.text(0.08, legend_y, "L\u00e9gende", fontsize=8, alpha=0.65, **text_kw)

    _legend_item(ax, 0.08, legend_y - 0.06, SUNSHINE, None, "Soleil")
    _legend_item(ax, 0.08, legend_y - 0.13, SHADOW, None, "Ombre")
    _legend_item(ax, 0.08, legend_y - 0.20, NIGHT_COLOR, None, "Nuit")


def _detail_row(ax, x, y, label, value, **kw):
    ax.text(x, y, label, fontsize=9, **kw)
    ax.text(0.92, y, value, fontsize=9, fontweight="bold", ha="right", **kw)


def _legend_item(ax, x, y, color, hatch, label):
    rect = mpatches.FancyBboxPatch(
        (x, y - 0.01), 0.12, 0.04,
        boxstyle="round,pad=0.005",
        facecolor=color,
        edgecolor=WHITE,
        linewidth=0.5,
        transform=ax.transAxes,
    )
    if hatch:
        rect.set_hatch(hatch)
        rect.set_edgecolor(SHADOW_HATCH)
    ax.add_patch(rect)
    ax.text(
        x + 0.17, y + 0.005, label,
        fontsize=7.5, color=WHITE, fontfamily="sans-serif",
        transform=ax.transAxes, va="center",
    )


def _draw_wrapped_text(ax, x, y, text, max_chars=20, line_spacing=0.035, **kw):
    words = text.split()
    lines = []
    current = ""
    for w in words:
        if current and len(current) + 1 + len(w) > max_chars:
            lines.append(current)
            current = w
        else:
            current = f"{current} {w}".strip()
    if current:
        lines.append(current)

    for i, line in enumerate(lines):
        ax.text(x, y - i * line_spacing, line, **kw)


# ---------------------------------------------------------------------------
# Main chart
# ---------------------------------------------------------------------------

def _draw_chart(ax, grid: np.ndarray, hours: list[float], summaries: list[dict]):
    from matplotlib.colors import ListedColormap

    n_steps, total_days = grid.shape

    # Custom colormap: night / shadow / sunny
    cmap = ListedColormap([
        (0.796, 0.835, 0.882, 0.4),   # 0 = night  (NIGHT_COLOR with alpha)
        (0.961, 0.847, 0.604, 0.85),   # 1 = shadow (SHADOW)
        (0.984, 0.812, 0.231, 0.95),   # 2 = sunny  (SUNSHINE)
    ])

    # Build edges for pcolormesh
    half_step = STEP_MINUTES / 120.0  # half step in hours
    y_edges = np.array([h - half_step for h in hours] + [hours[-1] + half_step])
    x_edges = np.arange(0.5, total_days + 1.5)

    ax.pcolormesh(x_edges, y_edges, grid, cmap=cmap, vmin=-0.5, vmax=2.5,
                  shading="flat", rasterized=True)

    # Sunrise/sunset curves overlay
    days = np.arange(1, total_days + 1)
    sunrise = _smooth(np.array([s["sunrise"] for s in summaries]))
    sunset = _smooth(np.array([s["sunset"] for s in summaries]))
    ax.plot(days, sunrise, color=SKY_BLUE_DASHED, linewidth=1.2,
            linestyle="--", alpha=0.8)
    ax.plot(days, sunset, color=SKY_BLUE_DASHED, linewidth=1.2,
            linestyle="--", alpha=0.8)

    # Axis formatting
    ax.set_xlim(0.5, total_days + 0.5)
    ax.set_ylim(hours[0] - half_step, hours[-1] + half_step)
    ax.invert_yaxis()  # early hours at top

    month_mids = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349]
    ax.set_xticks(month_mids)
    ax.set_xticklabels(MONTH_NAMES_FR, fontsize=9, fontfamily="sans-serif")

    hour_ticks = list(range(5, 22))
    ax.set_yticks(hour_ticks)
    ax.set_yticklabels(
        [f"{h}h" for h in hour_ticks],
        fontsize=8, fontfamily="sans-serif", color=AMBER_DARKER,
    )

    ax.tick_params(axis="both", length=0, pad=6)
    ax.grid(axis="y", color="#E2E8F0", linewidth=0.4, alpha=0.7)
    ax.grid(axis="x", color="#E2E8F0", linewidth=0.3, alpha=0.5)

    for spine in ax.spines.values():
        spine.set_visible(False)

    ax.text(
        0.01, 0.01,
        "Profil d\u2019ensoleillement \u00b7 Plus c\u2019est jaune, plus c\u2019est lumineux !",
        fontsize=7.5, color=AMBER_DARKER, fontfamily="sans-serif",
        fontstyle="italic", alpha=0.7,
        transform=ax.transAxes, ha="left", va="bottom",
    )


def _smooth(arr: np.ndarray, window: int = 5) -> np.ndarray:
    kernel = np.ones(window) / window
    padded = np.pad(arr, window // 2, mode="edge")
    return np.convolve(padded, kernel, mode="valid")[:len(arr)]


# ---------------------------------------------------------------------------
# Annotations (sunshine duration badges)
# ---------------------------------------------------------------------------

def _draw_annotations(ax, summaries: list[dict]):
    """Place sunshine-duration badges at key dates."""
    key_dates = [
        (15, "Jan"),    # mid-January
        (75, "Mar"),    # mid-March
        (172, "Jun"),   # summer solstice
        (258, "Sep"),   # mid-September
        (349, "Déc"),   # mid-December
    ]

    for doy_target, _label in key_dates:
        day = next((d for d in summaries if d["doy"] == doy_target), None)
        if day is None or day["sunny_minutes"] == 0:
            continue

        total_mins = int(round(day["sunny_minutes"]))
        h = total_mins // 60
        m = total_mins % 60
        txt = f"{h}h{m:02d}" if m > 0 else f"{h}h"

        # Position badge at midpoint between sunrise and sunset
        y_pos = (day["sunrise"] + day["sunset"]) / 2

        ax.annotate(
            txt,
            xy=(doy_target, y_pos),
            fontsize=8.5,
            fontweight="bold",
            color=WHITE,
            fontfamily="sans-serif",
            ha="center", va="center",
            bbox=dict(
                boxstyle="round,pad=0.4",
                facecolor=AMBER_DARK,
                edgecolor="none",
                alpha=0.9,
            ),
        )

    # Label "Terrasse au soleil" near summer solstice
    solstice = next((d for d in summaries if d["doy"] == 172), None)
    if solstice and solstice["sunny_minutes"] > 0:
        mid_y = (solstice["sunrise"] + solstice["sunset"]) / 2
        ax.text(
            195, mid_y + 0.6, "Terrasse\nau soleil",
            fontsize=10, fontweight="bold", color=AMBER_DARKER,
            fontfamily="sans-serif", ha="center", va="top",
            alpha=0.8,
        )


# ---------------------------------------------------------------------------
# QR code
# ---------------------------------------------------------------------------

def _draw_qr(fig, qr_url: str):
    """Draw QR code in the bottom-right corner of the figure."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(qr_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#333333", back_color=WHITE).convert("RGB")
    qr_arr = np.array(qr_img)

    # Create axes for QR block
    ax_qr = fig.add_axes([0.82, 0.76, 0.16, 0.22], facecolor=WHITE)
    ax_qr.set_xlim(0, 1)
    ax_qr.set_ylim(0, 1)
    ax_qr.set_xticks([])
    ax_qr.set_yticks([])
    for spine in ax_qr.spines.values():
        spine.set_edgecolor("#E2E8F0")
        spine.set_linewidth(0.8)
    ax_qr.patch.set_visible(True)

    ax_qr.text(
        0.5, 0.96, "Scannez-moi",
        fontsize=8, fontweight="bold", color=AMBER_DARK,
        fontfamily="sans-serif", ha="center", va="top",
        transform=ax_qr.transAxes,
    )
    ax_qr.text(
        0.5, 0.88, "ausoleil.app",
        fontsize=7, color="#64748B",
        fontfamily="sans-serif", ha="center", va="top",
        transform=ax_qr.transAxes,
    )

    ax_qr.imshow(qr_arr, extent=[0.1, 0.9, 0.05, 0.80], aspect="auto")


# ---------------------------------------------------------------------------
# Footer
# ---------------------------------------------------------------------------

def _draw_footer(fig):
    fig.text(
        0.5, 0.015,
        "Donn\u00e9es indicatives \u00b7 Calcul\u00e9es selon l\u2019orientation "
        "et la g\u00e9olocalisation de la terrasse \u00b7 \u00a9 ausoleil.app "
        + str(date.today().year),
        fontsize=6.5, color="#94A3B8", fontfamily="sans-serif",
        ha="center", va="bottom",
    )
