#!/usr/bin/env python3
# Hoja de contacto de la sección 11 punto 4: tres columnas (Rovaq, Handle y la referencia más
# cercana) alineadas por función de sección, con etiqueta de viewport y tema.
#
# Uso: python3 hoja-contacto.py --rovaq DIR_CAPTURAS --handle DIR_HANDLE [--ref DIR_REF]
#        --vp 1440 --esquema dark --salida hoja.png [--mapa mapa-secciones.json]
# Rovaq: PNG de capturar.mjs (nombre {vp}-{esquema}-normal-scroll-yNNNNN.png y indice.json).
# Handle y ref: JPG {vp}-pNN.jpg. Si falta una captura, la celda dice "sin captura".
import argparse, json, re, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def fuente(tam):
    for r in ('/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/Supplemental/Arial.ttf'):
        try: return ImageFont.truetype(r, tam)
        except Exception: pass
    return ImageFont.load_default()

def lista_rovaq(d, vp, esq, modo):
    pref = f'{vp}-{esq}-{modo}-scroll-'
    out = []
    for f in sorted(Path(d).glob(pref + 'y*.png')):
        m = re.search(r'-y(\d+)\.png$', f.name)
        if m: out.append((int(m.group(1)), f))
    return out

def lista_pNN(d, vp):
    out = []
    for f in sorted(Path(d).glob(f'{vp}-p[0-9][0-9].*')):
        m = re.search(r'-p(\d+)\.', f.name)
        if m: out.append((int(m.group(1)), f))
    return out

def por_fraccion(items, frac):
    if not items: return None
    i = round(max(0.0, min(1.0, frac)) * (len(items) - 1))
    return items[i][1]

def por_seccion(d, vp, esq, modo, nombre):
    f = Path(d) / f'{vp}-{esq}-{modo}-scroll-sec-{nombre}.png'
    return f if f.exists() else None

def celda(path, w, h, etiqueta, f):
    im = Image.new('RGB', (w, h), (225, 225, 228))
    d = ImageDraw.Draw(im)
    if path is None:
        d.text((12, h // 2 - 8), 'sin captura', fill=(120, 120, 126), font=f)
        return im
    src = Image.open(path).convert('RGB')
    esc = w / src.width
    t = src.resize((w, max(1, round(src.height * esc))), Image.LANCZOS)
    im.paste(t.crop((0, 0, w, min(h, t.height))), (0, 0))
    return im

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rovaq', required=True); ap.add_argument('--handle'); ap.add_argument('--ref')
    ap.add_argument('--vp', default='1440'); ap.add_argument('--esquema', default='dark')
    ap.add_argument('--modo', default='normal'); ap.add_argument('--salida', required=True)
    ap.add_argument('--mapa', default=str(Path(__file__).with_name('mapa-secciones.json')))
    ap.add_argument('--ancho-celda', type=int, default=0)
    ap.add_argument('--nombre-ref', default='Referencia (Ramp)')
    a = ap.parse_args()
    mapa = json.load(open(a.mapa))['funciones']
    movil = a.vp == '390'
    w = a.ancho_celda or (230 if movil else 520)
    h = round(w * (844 / 390)) if movil else round(w * 900 / 1440)
    h = min(h, 520)
    ft, fs = fuente(16), fuente(13)
    cab, izq, mar = 56, 150, 8
    ros = lista_rovaq(a.rovaq, a.vp, a.esquema, a.modo)
    han = lista_pNN(a.handle, a.vp) if a.handle else []
    ref = lista_pNN(a.ref, a.vp) if a.ref else []
    n = len(mapa)
    W = izq + 3 * (w + mar) + mar
    H = cab + n * (h + mar) + mar
    hoja = Image.new('RGB', (W, H), (250, 250, 250))
    d = ImageDraw.Draw(hoja)
    d.text((mar, 8), f'Hoja de contacto  viewport {a.vp}  tema {a.esquema}  modo {a.modo}', fill=(20, 20, 20), font=ft)
    for c, nombre in enumerate(['Rovaq', 'Handle', a.nombre_ref]):
        d.text((izq + c * (w + mar) + mar, 32), nombre, fill=(20, 20, 20), font=ft)
    faltan = 0
    for r, fn in enumerate(mapa):
        y = cab + r * (h + mar)
        d.text((mar, y + 4), fn['titulo'], fill=(40, 40, 40), font=fs)
        rv = fn.get('rovaq', {})
        p_r = por_seccion(a.rovaq, a.vp, a.esquema, a.modo, rv['seccion']) if 'seccion' in rv else None
        p_r = p_r or por_fraccion(ros, rv.get('fraccion', 0))
        hv = fn.get('handle', {}); p_h = por_fraccion(han, hv.get('fraccion', 0)) if han else None
        rf = fn.get('ref', hv); p_f = por_fraccion(ref, rf.get('fraccion', 0)) if ref else None
        for c, p in enumerate([p_r, p_h, p_f]):
            if p is None: faltan += 1
            hoja.paste(celda(p, w, h, '', fs), (izq + c * (w + mar) + mar, y))
    Path(a.salida).parent.mkdir(parents=True, exist_ok=True)
    hoja.save(a.salida)
    print(f'{a.salida} {W}x{H}, celdas sin captura: {faltan}')

if __name__ == '__main__':
    sys.exit(main())
