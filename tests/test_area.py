"""Teste do Passo 3 — área do polígono."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.area import area_do_poligono


def test_quadrado_conhecido():
    # quadrado de 100x100 px, GSD de 0.10 m/px  ->  10m x 10m = 100 m²
    pontos = [(0, 0), (100, 0), (100, 100), (0, 100)]
    r = area_do_poligono(pontos, gsd_m_per_px=0.10)
    assert abs(r.area_m2 - 100.0) < 1e-6
    assert abs(r.perimeter_m - 40.0) < 1e-6
    print(f"  [ok] quadrado -> {r.area_m2:.0f} m² (esperado 100)")


def test_retangulo_grande():
    # 4000 x 3000 px a 3.75 cm/px -> 150m x 112.5m = 16875 m² = 1.69 ha
    pontos = [(0, 0), (4000, 0), (4000, 3000), (0, 3000)]
    r = area_do_poligono(pontos, gsd_m_per_px=0.0375)
    assert abs(r.area_ha - 1.6875) < 1e-4
    print(f"  [ok] retângulo -> {r.resumo()}")


def test_poligono_invalido_se_cruza():
    # "gravata borboleta" — linhas se cruzam
    pontos = [(0, 0), (100, 100), (100, 0), (0, 100)]
    try:
        area_do_poligono(pontos, 0.10)
        assert False, "deveria rejeitar polígono que se cruza"
    except ValueError as e:
        assert "inválido" in str(e) or "cruz" in str(e)
        print("  [ok] rejeita polígono que se cruza")


def test_poucos_pontos():
    try:
        area_do_poligono([(0, 0), (10, 10)], 0.10)
        assert False
    except ValueError as e:
        assert "3 pontos" in str(e)
        print("  [ok] exige pelo menos 3 pontos")


if __name__ == "__main__":
    print("Passo 3 — área do polígono")
    test_quadrado_conhecido()
    test_retangulo_grande()
    test_poligono_invalido_se_cruza()
    test_poucos_pontos()
    print("\nTODOS OS TESTES PASSARAM \u2713")