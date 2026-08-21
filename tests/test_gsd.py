"""Teste do Passo 2 — cálculo do GSD."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.metadata import PhotoMetadata
from app.gsd import compute_gsd


def _md(**kw) -> PhotoMetadata:
    base = dict(
        focal_length_mm=None, focal_length_35mm=None,
        image_width_px=4000, image_height_px=3000,
        make="DJI", model=None,
        relative_altitude_m=100.0, absolute_altitude_m=None,
        gimbal_pitch_deg=-90.0, gps_lat=None, gps_lon=None,
    )
    base.update(kw)
    return PhotoMetadata(**base)


def test_metodo_35mm():
    # foco 35mm = 24, altura 100m, largura 4000px
    # GSD = 36 * 100 / (24 * 4000) = 0.0375 m/px = 3.75 cm/px
    r = compute_gsd(_md(focal_length_35mm=24.0))
    assert abs(r.gsd_m_per_px - 0.0375) < 1e-6
    assert abs(r.gsd_cm_per_px - 3.75) < 1e-4
    assert r.method == "equivalente 35mm"
    print(f"  [ok] metodo 35mm  -> {r.gsd_cm_per_px:.2f} cm/px")


def test_metodo_sensor_real():
    # Mini 3: sensor 9.65mm, foco real ~6.7mm, altura 100m
    # GSD = 9.65 * 100 / (6.7 * 4000) = 0.036007 m/px
    r = compute_gsd(_md(model="DJI Mini 3", focal_length_mm=6.7))
    esperado = (9.65 * 100) / (6.7 * 4000)
    assert abs(r.gsd_m_per_px - esperado) < 1e-9
    assert "sensor real" in r.method
    print(f"  [ok] sensor real  -> {r.gsd_cm_per_px:.2f} cm/px  ({r.method})")


def test_cobertura_no_chao():
    # a 100m, um quadro do Mini deve cobrir ~150m x 112m
    r = compute_gsd(_md(focal_length_35mm=24.0))
    assert 140 < r.ground_width_m < 160
    assert 105 < r.ground_height_m < 120
    print(f"  [ok] cobertura    -> {r.ground_width_m:.0f}m x {r.ground_height_m:.0f}m "
          f"= {r.ground_area_m2/10000:.2f} ha por foto")


def test_erro_sem_altitude():
    try:
        compute_gsd(_md(focal_length_35mm=24.0, relative_altitude_m=None))
        assert False, "deveria ter dado erro"
    except ValueError as e:
        assert "relative_altitude_m" in str(e)
        print("  [ok] erro claro quando falta altitude")


if __name__ == "__main__":
    print("Passo 2 — calculo do GSD")
    test_metodo_35mm()
    test_metodo_sensor_real()
    test_cobertura_no_chao()
    test_erro_sem_altitude()

    print("\nExemplo pratico (foto a 100m, foco 24mm equiv):")
    r = compute_gsd(_md(focal_length_35mm=24.0))
    print(f"  cada pixel  = {r.gsd_cm_per_px:.2f} cm no chao")
    print(f"  a foto cobre = {r.ground_width_m:.0f} x {r.ground_height_m:.0f} m")
    print(f"  ou seja      ~ {r.ground_area_m2/10000:.2f} hectares num unico quadro")
    print("\nTODOS OS TESTES PASSARAM \u2713")