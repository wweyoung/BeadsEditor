const rgbToLabCache = new Map();

function rgb2lab(r, g, b, a, cacheKey) {
    if (!cacheKey) {
        cacheKey = getColorCacheKey(r, g, b, a)
    }
    const cache = rgbToLabCache.get(cacheKey)
    if (cache) {
        return cache
    }
    let R = r / 255, G = g / 255, B = b / 255;
    R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
    G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
    B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;
    const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
    const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
    const Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
    const f = (t) => t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116;
    const result = [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
    rgbToLabCache.set(cacheKey, result)
    return result;
}

const COLOR_MERGE = 1

function getColorCacheKey(r, g, b, a = 1) {
    return (Math.floor(r / COLOR_MERGE) << 15) | (Math.floor(g / COLOR_MERGE) << 8) | Math.floor(b / COLOR_MERGE) | Boolean(a);
}

const FULL_PALETTE = [
    // A 系列 (黄色/橙色/红色系)
    {code: 'A1', r: 0xFA, g: 0xF4, b: 0xC8},
    {code: 'A2', r: 0xFF, g: 0xFF, b: 0xD5},
    {code: 'A3', r: 0xFE, g: 0xFF, b: 0x8B},
    {code: 'A4', r: 0xFB, g: 0xED, b: 0x56},
    {code: 'A5', r: 0xF4, g: 0xD7, b: 0x38},
    {code: 'A6', r: 0xFE, g: 0xAC, b: 0x4C},
    {code: 'A7', r: 0xFE, g: 0x8B, b: 0x4C},
    {code: 'A8', r: 0xFF, g: 0xDA, b: 0x45},
    {code: 'A9', r: 0xFF, g: 0x99, b: 0x5B},
    {code: 'A10', r: 0xF7, g: 0x7C, b: 0x31},
    {code: 'A11', r: 0xFF, g: 0xDD, b: 0x99},
    {code: 'A12', r: 0xFE, g: 0x9F, b: 0x72},
    {code: 'A13', r: 0xFF, g: 0xC3, b: 0x65},
    {code: 'A14', r: 0xFD, g: 0x54, b: 0x3D},
    {code: 'A15', r: 0xFF, g: 0xF3, b: 0x65},
    {code: 'A16', r: 0xFF, g: 0xFF, b: 0x9F},
    {code: 'A17', r: 0xFF, g: 0xE3, b: 0x6E},
    {code: 'A18', r: 0xFE, g: 0xBE, b: 0x7D},
    {code: 'A19', r: 0xFD, g: 0x7C, b: 0x72},
    {code: 'A20', r: 0xFF, g: 0xD5, b: 0x68},
    {code: 'A21', r: 0xFF, g: 0xE3, b: 0x95},
    {code: 'A22', r: 0xF4, g: 0xF5, b: 0x7D},
    {code: 'A23', r: 0xE6, g: 0xC9, b: 0xB7},
    {code: 'A24', r: 0xF7, g: 0xF8, b: 0xA2},
    {code: 'A25', r: 0xFF, g: 0xD6, b: 0x7D},
    {code: 'A26', r: 0xFF, g: 0xC8, b: 0x30},

// B 系列 (绿色系)
    {code: 'B1', r: 0xE6, g: 0xEE, b: 0x31},
    {code: 'B2', r: 0x63, g: 0xF3, b: 0x47},
    {code: 'B3', r: 0x9E, g: 0xF7, b: 0x80},
    {code: 'B4', r: 0x5D, g: 0xE0, b: 0x35},
    {code: 'B5', r: 0x35, g: 0xE3, b: 0x52},
    {code: 'B6', r: 0x65, g: 0xE2, b: 0xA6},
    {code: 'B7', r: 0x3D, g: 0xAF, b: 0x80},
    {code: 'B8', r: 0x1C, g: 0x9C, b: 0x4F},
    {code: 'B9', r: 0x27, g: 0x52, b: 0x3A},
    {code: 'B10', r: 0x95, g: 0xD3, b: 0xC2},
    {code: 'B11', r: 0x5D, g: 0x72, b: 0x2A},
    {code: 'B12', r: 0x16, g: 0x6F, b: 0x41},
    {code: 'B13', r: 0xCA, g: 0xEB, b: 0x7B},
    {code: 'B14', r: 0xAD, g: 0xE9, b: 0x46},
    {code: 'B15', r: 0x2E, g: 0x51, b: 0x32},
    {code: 'B16', r: 0xC5, g: 0xED, b: 0x9C},
    {code: 'B17', r: 0x9B, g: 0xB1, b: 0x3A},
    {code: 'B18', r: 0xE6, g: 0xEE, b: 0x49},
    {code: 'B19', r: 0x24, g: 0xB8, b: 0x8C},
    {code: 'B20', r: 0xC2, g: 0xF0, b: 0xCC},
    {code: 'B21', r: 0x15, g: 0x6A, b: 0x6B},
    {code: 'B22', r: 0x0B, g: 0x3C, b: 0x43},
    {code: 'B23', r: 0x30, g: 0x3A, b: 0x21},
    {code: 'B24', r: 0xEE, g: 0xFC, b: 0xA5},
    {code: 'B25', r: 0x4E, g: 0x84, b: 0x6D},
    {code: 'B26', r: 0x8D, g: 0x7A, b: 0x35},
    {code: 'B27', r: 0xCC, g: 0xE1, b: 0xAF},
    {code: 'B28', r: 0x9E, g: 0xE5, b: 0xB9},
    {code: 'B29', r: 0xC5, g: 0xE2, b: 0x54},
    {code: 'B30', r: 0xE2, g: 0xFC, b: 0xB1},
    {code: 'B31', r: 0xB0, g: 0xE7, b: 0x92},
    {code: 'B32', r: 0x9C, g: 0xAB, b: 0x5A},

// C 系列 (蓝色/青色系)
    {code: 'C1', r: 0xE8, g: 0xFF, b: 0xE7},
    {code: 'C2', r: 0xA9, g: 0xF9, b: 0xFC},
    {code: 'C3', r: 0xA0, g: 0xE2, b: 0xFB},
    {code: 'C4', r: 0x41, g: 0xCC, b: 0xFF},
    {code: 'C5', r: 0x01, g: 0xAC, b: 0xEB},
    {code: 'C6', r: 0x50, g: 0xAA, b: 0xF0},
    {code: 'C7', r: 0x36, g: 0x77, b: 0xD2},
    {code: 'C8', r: 0x0F, g: 0x54, b: 0xC0},
    {code: 'C9', r: 0x32, g: 0x4B, b: 0xCA},
    {code: 'C10', r: 0x3E, g: 0xBC, b: 0xE2},
    {code: 'C11', r: 0x28, g: 0xDD, b: 0xDE},
    {code: 'C12', r: 0x1C, g: 0x33, b: 0x4D},
    {code: 'C13', r: 0xCD, g: 0xE8, b: 0xFF},
    {code: 'C14', r: 0xD5, g: 0xFD, b: 0xFF},
    {code: 'C15', r: 0x22, g: 0xC4, b: 0xC6},
    {code: 'C16', r: 0x15, g: 0x57, b: 0xA8},
    {code: 'C17', r: 0x04, g: 0xD1, b: 0xF6},
    {code: 'C18', r: 0x1D, g: 0x33, b: 0x44},
    {code: 'C19', r: 0x18, g: 0x87, b: 0xA2},
    {code: 'C20', r: 0x17, g: 0x6D, b: 0xAF},
    {code: 'C21', r: 0xBE, g: 0xDD, b: 0xFF},
    {code: 'C22', r: 0x67, g: 0xB4, b: 0xBE},
    {code: 'C23', r: 0xC8, g: 0xE2, b: 0xFF},
    {code: 'C24', r: 0x7C, g: 0xC4, b: 0xFF},
    {code: 'C25', r: 0xA9, g: 0xE5, b: 0xE5},
    {code: 'C26', r: 0x3C, g: 0xAE, b: 0xD8},
    {code: 'C27', r: 0xD3, g: 0xDF, b: 0xFA},
    {code: 'C28', r: 0xBB, g: 0xCF, b: 0xED},
    {code: 'C29', r: 0x34, g: 0x48, b: 0x8E},

// D 系列 (紫色系)
    {code: 'D1', r: 0xAE, g: 0xB4, b: 0xF2},
    {code: 'D2', r: 0x85, g: 0x8E, b: 0xDD},
    {code: 'D3', r: 0x2F, g: 0x54, b: 0xAF},
    {code: 'D4', r: 0x18, g: 0x2A, b: 0x84},
    {code: 'D5', r: 0xB8, g: 0x43, b: 0xC5},
    {code: 'D6', r: 0xAC, g: 0x7B, b: 0xDE},
    {code: 'D7', r: 0x88, g: 0x54, b: 0xB3},
    {code: 'D8', r: 0xE2, g: 0xD3, b: 0xFF},
    {code: 'D9', r: 0xD5, g: 0xB9, b: 0xF8},
    {code: 'D10', r: 0x36, g: 0x18, b: 0x51},
    {code: 'D11', r: 0xB9, g: 0xBA, b: 0xE1},
    {code: 'D12', r: 0xDE, g: 0x9A, b: 0xD4},
    {code: 'D13', r: 0xB9, g: 0x00, b: 0x95},
    {code: 'D14', r: 0x8B, g: 0x27, b: 0x9B},
    {code: 'D15', r: 0x2F, g: 0x1F, b: 0x90},
    {code: 'D16', r: 0xE3, g: 0xE1, b: 0xEE},
    {code: 'D17', r: 0xC4, g: 0xD4, b: 0xF6},
    {code: 'D18', r: 0xA4, g: 0x5E, b: 0xC7},
    {code: 'D19', r: 0xD8, g: 0xC3, b: 0xD7},
    {code: 'D20', r: 0x9C, g: 0x32, b: 0xB2},
    {code: 'D21', r: 0x9A, g: 0x00, b: 0x9B},
    {code: 'D22', r: 0x33, g: 0x3A, b: 0x95},
    {code: 'D23', r: 0xEB, g: 0xDA, b: 0xFC},
    {code: 'D24', r: 0x77, g: 0x86, b: 0xE5},
    {code: 'D25', r: 0x49, g: 0x4F, b: 0xC7},
    {code: 'D26', r: 0xDF, g: 0xC2, b: 0xF8},

// E 系列 (粉色系)
    {code: 'E1', r: 0xFD, g: 0xD3, b: 0xCC},
    {code: 'E2', r: 0xFE, g: 0xC0, b: 0xDF},
    {code: 'E3', r: 0xFF, g: 0xB7, b: 0xE7},
    {code: 'E4', r: 0xE8, g: 0x64, b: 0x9E},
    {code: 'E5', r: 0xF5, g: 0x51, b: 0xA2},
    {code: 'E6', r: 0xF1, g: 0x3D, b: 0x74},
    {code: 'E7', r: 0xC6, g: 0x34, b: 0x78},
    {code: 'E8', r: 0xFF, g: 0xDB, b: 0xE9},
    {code: 'E9', r: 0xE9, g: 0x70, b: 0xCC},
    {code: 'E10', r: 0xD3, g: 0x37, b: 0x93},
    {code: 'E11', r: 0xFC, g: 0xDD, b: 0xD2},
    {code: 'E12', r: 0xF7, g: 0x8F, b: 0xC3},
    {code: 'E13', r: 0xB5, g: 0x00, b: 0x6D},
    {code: 'E14', r: 0xFF, g: 0xD1, b: 0xBA},
    {code: 'E15', r: 0xF8, g: 0xC7, b: 0xC9},
    {code: 'E16', r: 0xFF, g: 0xF3, b: 0xEB},
    {code: 'E17', r: 0xFF, g: 0xE2, b: 0xEA},
    {code: 'E18', r: 0xFF, g: 0xC7, b: 0xDB},
    {code: 'E19', r: 0xFE, g: 0xBA, b: 0xD5},
    {code: 'E20', r: 0xD8, g: 0xC7, b: 0xD1},
    {code: 'E21', r: 0xBD, g: 0x9D, b: 0xA1},
    {code: 'E22', r: 0xB7, g: 0x85, b: 0xA1},
    {code: 'E23', r: 0x93, g: 0x7A, b: 0x8D},
    {code: 'E24', r: 0xE1, g: 0xBC, b: 0xE8},

// F 系列 (红色系)
    {code: 'F1', r: 0xFD, g: 0x95, b: 0x7B},
    {code: 'F2', r: 0xFC, g: 0x3D, b: 0x46},
    {code: 'F3', r: 0xF7, g: 0x49, b: 0x41},
    {code: 'F4', r: 0xFC, g: 0x28, b: 0x3C},
    {code: 'F5', r: 0xE7, g: 0x00, b: 0x2F},
    {code: 'F6', r: 0x94, g: 0x36, b: 0x30},
    {code: 'F7', r: 0x97, g: 0x19, b: 0x37},
    {code: 'F8', r: 0xBC, g: 0x00, b: 0x28},
    {code: 'F9', r: 0xE2, g: 0x67, b: 0x7A},
    {code: 'F10', r: 0x8A, g: 0x45, b: 0x26},
    {code: 'F11', r: 0x5A, g: 0x21, b: 0x21},
    {code: 'F12', r: 0xFD, g: 0x4E, b: 0x6A},
    {code: 'F13', r: 0xF3, g: 0x57, b: 0x44},
    {code: 'F14', r: 0xFF, g: 0xA9, b: 0xAD},
    {code: 'F15', r: 0xD3, g: 0x00, b: 0x22},
    {code: 'F16', r: 0xFE, g: 0xC2, b: 0xA6},
    {code: 'F17', r: 0xE6, g: 0x9C, b: 0x79},
    {code: 'F18', r: 0xD3, g: 0x7C, b: 0x46},
    {code: 'F19', r: 0xC1, g: 0x44, b: 0x4A},
    {code: 'F20', r: 0xCD, g: 0x93, b: 0x91},
    {code: 'F21', r: 0xF7, g: 0xB4, b: 0xC6},
    {code: 'F22', r: 0xFD, g: 0xC0, b: 0xD0},
    {code: 'F23', r: 0xF6, g: 0x7E, b: 0x66},
    {code: 'F24', r: 0xE6, g: 0x98, b: 0xAA},
    {code: 'F25', r: 0xE5, g: 0x4B, b: 0x4F},

// G 系列 (棕色/土色系)
    {code: 'G1', r: 0xFF, g: 0xE2, b: 0xCE},
    {code: 'G2', r: 0xFF, g: 0xC4, b: 0xAA},
    {code: 'G3', r: 0xF4, g: 0xC3, b: 0xA5},
    {code: 'G4', r: 0xE1, g: 0xB3, b: 0x83},
    {code: 'G5', r: 0xED, g: 0xB0, b: 0x45},
    {code: 'G6', r: 0xE9, g: 0x9C, b: 0x17},
    {code: 'G7', r: 0x9D, g: 0x5B, b: 0x3E},
    {code: 'G8', r: 0x75, g: 0x38, b: 0x32},
    {code: 'G9', r: 0xE6, g: 0xB4, b: 0x83},
    {code: 'G10', r: 0xD9, g: 0x8C, b: 0x39},
    {code: 'G11', r: 0xE0, g: 0xC5, b: 0x93},
    {code: 'G12', r: 0xFF, g: 0xC8, b: 0x90},
    {code: 'G13', r: 0xB7, g: 0x71, b: 0x4A},
    {code: 'G14', r: 0x8D, g: 0x61, b: 0x4C},
    {code: 'G15', r: 0xFC, g: 0xF9, b: 0xE0},
    {code: 'G16', r: 0xF2, g: 0xD9, b: 0xBA},
    {code: 'G17', r: 0x78, g: 0x52, b: 0x4B},
    {code: 'G18', r: 0xFF, g: 0xE4, b: 0xCC},
    {code: 'G19', r: 0xE0, g: 0x79, b: 0x35},
    {code: 'G20', r: 0xA9, g: 0x40, b: 0x23},
    {code: 'G21', r: 0xB8, g: 0x85, b: 0x58},

// H 系列 (灰度/白色/黑色系)
    {code: 'H1', r: 0xFF, g: 0xFF, b: 0xFF, a: 150},
    {code: 'H2', r: 0xFE, g: 0xFF, b: 0xFF},
    {code: 'H3', r: 0xB6, g: 0xB1, b: 0xBA},
    {code: 'H4', r: 0x89, g: 0x85, b: 0x8C},
    {code: 'H5', r: 0x48, g: 0x46, b: 0x4E},
    {code: 'H6', r: 0x2F, g: 0x2B, b: 0x2F},
    {code: 'H7', r: 0x00, g: 0x00, b: 0x00},
    {code: 'H8', r: 0xE7, g: 0xD6, b: 0xDB},
    {code: 'H9', r: 0xED, g: 0xED, b: 0xED},
    {code: 'H10', r: 0xEE, g: 0xE9, b: 0xEA},
    {code: 'H11', r: 0xCE, g: 0xCD, b: 0xD5},
    {code: 'H12', r: 0xFF, g: 0xF5, b: 0xED},
    {code: 'H13', r: 0xF5, g: 0xEC, b: 0xD2},
    {code: 'H14', r: 0xCF, g: 0xD7, b: 0xD3},
    {code: 'H15', r: 0x98, g: 0xA6, b: 0xA8},
    {code: 'H16', r: 0x1D, g: 0x14, b: 0x14},
    {code: 'H17', r: 0xF1, g: 0xED, b: 0xED},
    {code: 'H18', r: 0xFF, g: 0xFD, b: 0xF0},
    {code: 'H19', r: 0xF6, g: 0xEF, b: 0xE2},
    {code: 'H20', r: 0x94, g: 0x9F, b: 0xA3},
    {code: 'H21', r: 0xFF, g: 0xFB, b: 0xE1},
    {code: 'H22', r: 0xCA, g: 0xCA, b: 0xD4},
    {code: 'H23', r: 0x9A, g: 0x9D, b: 0x94},

// M 系列 (中性色系)
    {code: 'M1', r: 0xBC, g: 0xC6, b: 0xB8},
    {code: 'M2', r: 0x8A, g: 0xA3, b: 0x86},
    {code: 'M3', r: 0x69, g: 0x7D, b: 0x80},
    {code: 'M4', r: 0xE3, g: 0xD2, b: 0xBC},
    {code: 'M5', r: 0xD0, g: 0xCC, b: 0xAA},
    {code: 'M6', r: 0xB0, g: 0xA7, b: 0x82},
    {code: 'M7', r: 0xB4, g: 0xA4, b: 0x97},
    {code: 'M8', r: 0xB3, g: 0x82, b: 0x81},
    {code: 'M9', r: 0xA5, g: 0x87, b: 0x67},
    {code: 'M10', r: 0xC5, g: 0xB2, b: 0xBC},
    {code: 'M11', r: 0x9F, g: 0x75, b: 0x94},
    {code: 'M12', r: 0x64, g: 0x47, b: 0x49},
    {code: 'M13', r: 0xD1, g: 0x90, b: 0x66},
    {code: 'M14', r: 0xC7, g: 0x73, b: 0x62},
    {code: 'M15', r: 0x75, g: 0x7D, b: 0x78},

// P 系列 (淡色系)
    {code: 'P1', r: 0xFC, g: 0xF7, b: 0xF8},
    {code: 'P2', r: 0xB0, g: 0xA9, b: 0xAC},
    {code: 'P3', r: 0xAF, g: 0xDC, b: 0xAB},
    {code: 'P4', r: 0xFE, g: 0xA4, b: 0x9F},
    {code: 'P5', r: 0xEE, g: 0x8C, b: 0x3E},
    {code: 'P6', r: 0x5F, g: 0xD0, b: 0xA7},
    {code: 'P7', r: 0xEB, g: 0x92, b: 0x70},
    {code: 'P8', r: 0xF0, g: 0xD9, b: 0x58},
    {code: 'P9', r: 0xD9, g: 0xD9, b: 0xD9},
    {code: 'P10', r: 0xD9, g: 0xC7, b: 0xEA},
    {code: 'P11', r: 0xF3, g: 0xEC, b: 0xC9},
    {code: 'P12', r: 0xE6, g: 0xEE, b: 0xF2},
    {code: 'P13', r: 0xAA, g: 0xCB, b: 0xEF},
    {code: 'P14', r: 0x33, g: 0x76, b: 0x80},
    {code: 'P15', r: 0x66, g: 0x85, b: 0x75},
    {code: 'P16', r: 0xFE, g: 0xBF, b: 0x45},
    {code: 'P17', r: 0xFE, g: 0xA3, b: 0x24},
    {code: 'P18', r: 0xFE, g: 0xB8, b: 0x9F},
    {code: 'P19', r: 0xFF, g: 0xFE, b: 0xEC},
    {code: 'P20', r: 0xFE, g: 0xBE, b: 0xCF},
    {code: 'P21', r: 0xEC, g: 0xBE, b: 0xBF},
    {code: 'P22', r: 0xE4, g: 0xA8, b: 0x9F},
    {code: 'P23', r: 0xA5, g: 0x62, b: 0x68},

// Q 系列 (特殊色)
    {code: 'Q1', r: 0xF2, g: 0xA5, b: 0xE8},
    {code: 'Q2', r: 0xE9, g: 0xEC, b: 0x91},
    {code: 'Q3', r: 0xFF, g: 0xFF, b: 0x00},
    {code: 'Q4', r: 0xFF, g: 0xEB, b: 0xFA},
    {code: 'Q5', r: 0x76, g: 0xCE, b: 0xDE},

// R 系列 (混合色)
    {code: 'R1', r: 0xD5, g: 0x0D, b: 0x21},
    {code: 'R2', r: 0xF9, g: 0x2F, b: 0x83},
    {code: 'R3', r: 0xFD, g: 0x83, b: 0x24},
    {code: 'R4', r: 0xF8, g: 0xEC, b: 0x31},
    {code: 'R5', r: 0x35, g: 0xC7, b: 0x5B},
    {code: 'R6', r: 0x23, g: 0x88, b: 0x91},
    {code: 'R7', r: 0x19, g: 0x77, b: 0x9D},
    {code: 'R8', r: 0x1A, g: 0x60, b: 0xC3},
    {code: 'R9', r: 0x9A, g: 0x56, b: 0xB4},
    {code: 'R10', r: 0xFF, g: 0xDB, b: 0x4C},
    {code: 'R11', r: 0xFF, g: 0xEB, b: 0xFA},
    {code: 'R12', r: 0xD8, g: 0xD5, b: 0xCE},
    {code: 'R13', r: 0x55, g: 0x51, b: 0x4C},
    {code: 'R14', r: 0x9F, g: 0xE4, b: 0xDF},
    {code: 'R15', r: 0x77, g: 0xCE, b: 0xE9},
    {code: 'R16', r: 0x3E, g: 0xCF, b: 0xCA},
    {code: 'R17', r: 0x4A, g: 0x86, b: 0x7A},
    {code: 'R18', r: 0x7F, g: 0xCD, b: 0x9D},
    {code: 'R19', r: 0xCD, g: 0xE5, b: 0x5D},
    {code: 'R20', r: 0xE8, g: 0xC7, b: 0xB4},
    {code: 'R21', r: 0xAD, g: 0x6F, b: 0x3C},
    {code: 'R22', r: 0x6C, g: 0x37, b: 0x2F},
    {code: 'R23', r: 0xFE, g: 0xB8, b: 0x72},
    {code: 'R24', r: 0xF3, g: 0xC1, b: 0xC0},
    {code: 'R25', r: 0xC9, g: 0x67, b: 0x5E},
    {code: 'R26', r: 0xD2, g: 0x93, b: 0xBE},
    {code: 'R27', r: 0xEA, g: 0x8C, b: 0xB1},
    {code: 'R28', r: 0x9C, g: 0x87, b: 0xD6},

// T 系列 (白色)
    {code: 'T1', r: 0xFF, g: 0xFF, b: 0xFF},

// Y 系列
    {code: 'Y1', r: 0xFD, g: 0x6F, b: 0xB4},
    {code: 'Y2', r: 0xFE, g: 0xB4, b: 0x81},
    {code: 'Y3', r: 0xD7, g: 0xFA, b: 0xA0},
    {code: 'Y4', r: 0x8B, g: 0xDB, b: 0xFA},
    {code: 'Y5', r: 0xE9, g: 0x87, b: 0xEA},

// ZG 系列
    {code: 'ZG1', r: 0xDA, g: 0xAB, b: 0xB3},
    {code: 'ZG2', r: 0xD6, g: 0xAA, b: 0x87},
    {code: 'ZG3', r: 0xC1, g: 0xBD, b: 0x8D},
    {code: 'ZG4', r: 0x96, g: 0x86, b: 0x9F},
    {code: 'ZG5', r: 0x84, g: 0x90, b: 0xA6},
    {code: 'ZG6', r: 0x94, g: 0xBF, b: 0xE2},
    {code: 'ZG7', r: 0xE2, g: 0xA9, b: 0xD2},
    {code: 'ZG8', r: 0xAB, g: 0x91, b: 0xC0}
];

const PALETTE_MAP = new Map()
FULL_PALETTE.forEach((c) => {
    c.a ??= 255
    const [L, A, B] = rgb2lab(c.r, c.g, c.b, c.a);
    c.L = L;
    c.A = A;
    c.B = B;
    c.hex = `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}${c.a.toString(16).padStart(2, '0')}`;
    PALETTE_MAP[c.code] = c
});

PALETTE_MAP[null] = PALETTE_MAP[undefined] = PALETTE_MAP[''] = {code: null, r: 0, g: 0, b: 0, a: 0}

const palette_96_codes = [
    "A4", "A6", "A7", "A13", "A11", "A10", "A3", "A14",
    "B3", "B5", "B8", "B12", "B20", "B18", "B10", "B14", "B19", "B17", "B7",
    "C3", "C5", "C8", "C2", "C13", "C10", "C6", "C11", "C7", "C16",
    "D9", "D6", "D7", "D19", "D18", "D21", "D13", "D3", "D15", "D16", "D8", "D11", "D12", "D2", "D20", "D14", "D5",
    "E2", "E4", "E8", "E3", "E7", "E1", "E12", "E5", "E13", "E11", "E14", "E15", "E9", "E6", "E10",
    "F5", "F13", "F8", "F10", "F7", "F1", "F14", "F9", "F2", "F12", "F3", "F11", "F4", "F6",
    "G1", "G5", "G7", "G9", "G13", "G8", "G2", "G3", "G14", "G17",
    "H1", "H2", "H3", "H4", "H5", "H7", "H6",
    "M6", "M5", "M9", "M12"
];

const palette_221_codes = [
    ...palette_96_codes,
    "A1", "A2", "A5", "A8", "A9", "A12", "A15", "A16", "A17", "A18", "A19", "A20", "A21", "A22", "A23", "A24", "A25", "A26",
    "B1", "B2", "B4", "B6", "B9", "B11", "B13", "B15", "B16", "B21", "B22", "B23", "B24", "B25", "B26", "B27", "B28", "B29", "B30", "B31", "B32",
    "C1", "C4", "C9", "C12", "C14", "C15", "C17", "C18", "C19", "C20", "C21", "C22", "C23", "C24", "C25", "C26", "C27", "C28", "C29",
    "D1", "D4", "D10", "D17", "D22", "D23", "D24", "D25", "D26",
    "E16", "E17", "E18", "E19", "E20", "E21", "E22", "E23", "E24",
    "F15", "F16", "F17", "F18", "F19", "F20", "F21", "F22", "F23", "F24", "F25",
    "G4", "G6", "G10", "G11", "G12", "G15", "G16", "G18", "G19", "G20", "G21",
    "H8", "H9", "H10", "H11", "H12", "H13", "H14", "H15", "H16", "H17", "H18", "H19", "H20", "H21", "H22", "H23",
    "M1", "M2", "M3", "M4", "M7", "M8", "M10", "M11", "M13", "M14", "M15"
]
const PALETTES = {
    "ALL": FULL_PALETTE,
    "221": FULL_PALETTE.filter((p) => palette_221_codes.includes(p.code)),
    "96": FULL_PALETTE.filter((p) => palette_96_codes.includes(p.code)),
}


function getPalette(code) {
    if (PALETTES[code]) return PALETTES[code];
    // 尝试从自定义色号套装加载
    const custom = loadCustomPalette(code);
    if (custom) {
        return custom.codes.map(c => PALETTE_MAP[c]).filter(Boolean);
    }
    return FULL_PALETTE;
}

const COLOR_MODES = {ALL: "全色号", "221": "221色", "96": "96色"};

function colorDistanceFast(L1, a1, b1, L2, a2, b2) {
    const dL = L1 - L2;
    const da = a1 - a2;
    const db = b1 - b2;
    return Math.sqrt(dL * dL + da * da + db * db);  // 不开平方，直接比较平方值
}

function colorDistance(L1, A1, B1, a1, L2, A2, B2, a2, minDist) {
    const needEarlyExit = minDist && isFinite(minDist);
    let distance = 0;

    distance += Math.abs(a1 - a2);
    if (needEarlyExit && distance > minDist) return distance;

    const degToRad = Math.PI / 180;
    const radToDeg = 180 / Math.PI;

    // ========== L 分量 ==========
    const deltaLp = L2 - L1;
    const L_avg = (L1 + L2) / 2;
    const L_avg_minus_50 = L_avg - 50;
    const SL = 1 + (0.015 * L_avg_minus_50 * L_avg_minus_50) / Math.sqrt(20 + L_avg_minus_50 * L_avg_minus_50);
    const termL = Math.pow(deltaLp / SL, 2);
    distance += termL;
    if (needEarlyExit && distance > minDist) return distance;

    // ========== C 分量 ==========
    const C1 = Math.hypot(A1, B1);
    const C2 = Math.hypot(A2, B2);
    const C_avg = (C1 + C2) / 2;

    const C_avg_pow7 = Math.pow(C_avg, 7);
    const G = 0.5 * (1 - Math.sqrt(C_avg_pow7 / (C_avg_pow7 + Math.pow(25, 7))));

    const a1p = A1 * (1 + G);
    const a2p = A2 * (1 + G);
    const C1p = Math.hypot(a1p, B1);
    const C2p = Math.hypot(a2p, B2);
    const C_avgp = (C1p + C2p) / 2;

    const deltaCp = C2p - C1p;
    const SC = 1 + 0.045 * C_avgp;
    const termC = Math.pow(deltaCp / SC, 2);
    distance += termC
    if (needEarlyExit && distance > minDist) return distance;

    // ========== H 分量 ==========
    let h1p = Math.atan2(B1, a1p) * radToDeg;
    if (h1p < 0) h1p += 360;
    let h2p = Math.atan2(B2, a2p) * radToDeg;
    if (h2p < 0) h2p += 360;

    let deltaHp, H_avgp;
    const isLowChroma = C1p === 0 || C2p === 0;

    if (isLowChroma) {
        deltaHp = 0;
        H_avgp = 0;  // 低彩度时色相角无意义，设 0 避免后续计算异常
    } else {
        let diff = h2p - h1p;
        if (Math.abs(diff) <= 180) deltaHp = diff;
        else if (diff > 180) deltaHp = diff - 360;
        else deltaHp = diff + 360;

        let sum = h1p + h2p;
        let diffAbs = Math.abs(h1p - h2p);
        if (diffAbs <= 180) H_avgp = sum / 2;
        else if (sum < 360) H_avgp = (sum + 360) / 2;
        else H_avgp = (sum - 360) / 2;
    }

    const T = 1
        - 0.17 * Math.cos((H_avgp - 30) * degToRad)
        + 0.24 * Math.cos((2 * H_avgp) * degToRad)
        + 0.32 * Math.cos((3 * H_avgp + 6) * degToRad)
        - 0.20 * Math.cos((4 * H_avgp - 63) * degToRad);

    const SH = 1 + 0.015 * C_avgp * T;
    const deltaHpC = 2 * Math.sqrt(C1p * C2p) * Math.sin((deltaHp / 2) * degToRad);
    const termH = Math.pow(deltaHpC / SH, 2);
    distance += termH;
    if (needEarlyExit && distance > minDist) return distance;

    // ========== 交叉项 ==========
    const deltaTheta = 30 * Math.exp(-Math.pow((H_avgp - 275) / 25, 2));
    const RC = 2 * Math.sqrt(Math.pow(C_avgp, 7) / (Math.pow(C_avgp, 7) + Math.pow(25, 7)));
    const RT = -Math.sin(2 * deltaTheta * degToRad) * RC;
    const termCross = RT * (deltaCp / SC) * (deltaHpC / SH);
    distance += termCross;
    // ✅ 标准 CIEDE2000：返回开平方后的真实距离
    return distance;
}

function isHighlightColor(color) {
    if (color.highlight) {
        return color.highlight
    }
    if (!color.a) {
        return color.highlight = 255;
    }
    return color.highlight = ((color.r * 299 + color.g * 587 + color.b * 114) / 1000)
}

// ---------- 自定义色号套装 (localStorage) ----------
const STORAGE_KEY = 'beads_custom_palettes';

function loadCustomPalettes() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function saveCustomPalettes(palettes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(palettes));
}

function loadCustomPalette(id) {
    return loadCustomPalettes().find(p => p.id === id) || null;
}

function nextCustomPaletteId() {
    return 'custom_' + Date.now();
}

function getSimilarColor(L, A, B, a, palette, top = 20) {
    palette = [...palette];
    palette.forEach((c) => c.distance = colorDistance(L, A, B, a, c.L, c.A, c.B, c.a))
    return palette.sort((a, b) => a.distance - b.distance).slice(0, top);
}

export {
    FULL_PALETTE,
    PALETTES,
    PALETTE_MAP,
    COLOR_MODES,
    rgb2lab,
    getPalette,
    colorDistance,
    getColorCacheKey,
    colorDistanceFast,
    isHighlightColor,
    loadCustomPalettes,
    saveCustomPalettes,
    loadCustomPalette,
    nextCustomPaletteId,
    getSimilarColor
};
