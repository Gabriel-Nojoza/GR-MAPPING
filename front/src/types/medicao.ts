export interface Analise {
    modelo_camera: string | null;
    altura_voo_m: number | null;
    gsd_cm_por_px: number;
    cobertura_m: {largura: number; altura: number};
    cobertura_hectares: number;
    avisos: string[];
    disclaimer: string;
}

export interface Medicao {
    area_m2: number;
    area_hectares: number;
    perimetro_m: number;
    resumo: string;
    gsd_cm_por_px: number;
    avisos: string[];
    disclaimer: string;
}


export interface Ponto {
    x: number;
    y: number;
}

