#!/usr/bin/env python3
"""
Ordena los canales de iptv-org en carpetas (group-title) para reproductores IPTV.

Uso:
    python3 ordenar_canales.py                 # descarga iptv-org y genera las listas
    python3 ordenar_canales.py --iptv DIR --db DIR   # usa copias locales ya clonadas

Genera en iptv/listas/:
    canales_ordenados.m3u   -> todo junto, ordenado por carpetas
    chile.m3u, argentina.m3u, espana.m3u, mexico.m3u, latam.m3u, tematicos.m3u
"""
import argparse
import csv
import os
import re
import subprocess
import sys
import tempfile
from collections import defaultdict

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, "listas")

# ---------------------------------------------------------------- países

PAISES_PRINCIPALES = {"CL": "Chile", "AR": "Argentina", "ES": "España", "MX": "México"}
PAISES_LATAM = {
    "PE": "Perú", "CO": "Colombia", "UY": "Uruguay", "PY": "Paraguay", "BO": "Bolivia",
    "EC": "Ecuador", "VE": "Venezuela", "CR": "Costa Rica", "PA": "Panamá",
    "GT": "Guatemala", "HN": "Honduras", "SV": "El Salvador", "NI": "Nicaragua",
    "DO": "Rep. Dominicana", "CU": "Cuba", "PR": "Puerto Rico",
}

# Canales "grandes" de cada país (el resto de generales va a Regionales/Locales).
NACIONALES = {
    "CL": r"^(tvn|canal 13|13c|mega\b|mega 2|chilevisi|chv|la red|tv\+|telecanal|24 horas|"
          r"ntv|t13|meganoticias|cnn chile|tv senado|canal 24 horas)",
    "AR": r"^(telefe|el trece|eltrece|am[eé]rica|tv p[uú]blica|el nueve|canal 9|net tv|"
          r"tn\b|todo noticias|c5n|a24|ln\+|canal 26|cr[oó]nica|encuentro|pakapaka|"
          r"deportv|canal 7)",
    "MX": r"^(las estrellas|canal 5|azteca|imagen tv|canal once|once|canal 22|adn 40|"
          r"multimedios|milenio|a\+|nu9ve|foro tv|n\+)",
}

# TDT nacional de España.
TDT_ESPANA = (r"^(la 1|la 2|antena 3|cuatro|telecinco|la ?sexta|clan|teledeporte|canal 24 horas|"
              r"24h|neox|nova|mega|fdf|energy|divinity|boing|be ?mad|dmax|ten\b|dkiss|trece|"
              r"paramount network|real madrid tv|atreseries|gol\b|gol play|7rm|tvg|etb|tv3|"
              r"canal sur|telemadrid|[aà] punt|cmm|aragon tv|ib3|tpa|canal extremadura|"
              r"tvcan|televisi[oó]n canaria|la 7|el 33|esport3|3cat)")

MOTOR = re.compile(r"(formula ?1|f[óo]rmula|\bf1\b|motor|racing|nascar|motogp|\bmoto|rally|"
                   r"indycar|speed|red bull tv|autos?\b|garage|drift)", re.I)

DEPORTES = re.compile(r"(sport|deport|f[uú]tbol|futbol|\bgol\b|espn|tyc|tnt sports|\bcdf\b|"
                      r"\bfox sports|win sports|dazn|\bliga\b|\bnba\b|\bnfl\b|\bmlb\b|tenis|tennis|"
                      r"golf|boxing|boxeo|ufc|wwe|fight|combat|ringside)", re.I)

# ---------------------------------------------------------------- categorías

# Orden de prioridad cuando un canal tiene varias categorías.
CATEGORIA_CARPETA = [
    ("news", "Noticias"),
    ("sports", "Deportes"),
    ("kids", "Infantil"),
    ("animation", "Infantil"),
    ("movies", "Películas"),
    ("series", "Series"),
    ("music", "Música"),
    ("documentary", "Documentales y Cultura"),
    ("science", "Documentales y Cultura"),
    ("education", "Documentales y Cultura"),
    ("culture", "Documentales y Cultura"),
    ("travel", "Documentales y Cultura"),
    ("outdoor", "Documentales y Cultura"),
    ("comedy", "Entretenimiento"),
    ("entertainment", "Entretenimiento"),
    ("lifestyle", "Entretenimiento"),
    ("cooking", "Entretenimiento"),
    ("family", "Entretenimiento"),
    ("classic", "Entretenimiento"),
    ("religious", "Religiosos"),
    ("legislative", "Gobierno y Parlamento"),
    ("public", "Gobierno y Parlamento"),
    ("business", "Noticias"),
    ("weather", "Noticias"),
    ("shop", "Otros"),
    ("relax", "Otros"),
    ("interactive", "Otros"),
    ("auto", "Motor"),
    ("general", "General"),
]

# Orden de las carpetas dentro de cada país.
ORDEN_SUB = ["Nacionales", "TDT Nacional", "Autonómicos", "Noticias", "Deportes", "Motor",
             "Películas", "Series", "Entretenimiento", "Infantil", "Música",
             "Documentales y Cultura", "Regionales y Locales", "Gobierno y Parlamento",
             "Religiosos", "Otros"]

# Carpetas temáticas internacionales: (nombre, categoría interna, idioma o None).
TEMATICOS = [
    ("Fórmula 1 y Motor", "Motor", None),
    ("Deportes Internacional", "Deportes", None),
    ("Películas en Español", "Películas", "spa"),
    ("Películas en Inglés", "Películas", "eng"),
    ("Series en Español", "Series", "spa"),
    ("Series en Inglés", "Series", "eng"),
    ("Infantil en Español", "Infantil", "spa"),
    ("Noticias Internacionales en Español", "Noticias", "spa"),
    ("Noticias Internacionales en Inglés", "Noticias", "eng"),
    ("Documentales en Español", "Documentales y Cultura", "spa"),
    ("Documentales en Inglés", "Documentales y Cultura", "eng"),
    ("Música en Español", "Música", "spa"),
    ("Entretenimiento en Español", "Entretenimiento", "spa"),
]


def leer_csv(ruta):
    with open(ruta, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def clonar(destino, repo):
    subprocess.run(["git", "clone", "-q", "--depth", "1",
                    f"https://github.com/iptv-org/{repo}.git", destino], check=True)


def parsear_m3u(ruta):
    """Devuelve lista de dicts: tvg_id, nombre, url, opciones (#EXTVLCOPT), attrs extra."""
    entradas, actual, opts = [], None, []
    with open(ruta, encoding="utf-8", errors="ignore") as f:
        for linea in f:
            linea = linea.strip()
            if linea.startswith("#EXTINF"):
                m_id = re.search(r'tvg-id="([^"]*)"', linea)
                extra = {k: v for k, v in re.findall(r'(http-referrer|http-user-agent)="([^"]*)"', linea)}
                actual = {"tvg_id": m_id.group(1) if m_id else "",
                          "nombre": linea.rsplit(",", 1)[-1].strip(), "extra": extra}
                opts = []
            elif linea.startswith("#EXTVLCOPT") and actual is not None:
                opts.append(linea)
            elif linea and not linea.startswith("#") and actual is not None:
                actual["url"] = linea
                actual["opts"] = opts
                entradas.append(actual)
                actual, opts = None, []
    return entradas


def calidad(nombre):
    m = re.search(r"\((\d{3,4})p\)", nombre)
    return int(m.group(1)) if m else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--iptv", help="carpeta local del repo iptv-org/iptv")
    ap.add_argument("--db", help="carpeta local del repo iptv-org/database")
    args = ap.parse_args()

    tmp = tempfile.mkdtemp()
    iptv_dir = args.iptv or os.path.join(tmp, "iptv")
    db_dir = args.db or os.path.join(tmp, "database")
    if not args.iptv:
        clonar(iptv_dir, "iptv")
    if not args.db:
        clonar(db_dir, "database")

    datos = os.path.join(db_dir, "data")
    canales = {c["id"]: c for c in leer_csv(os.path.join(datos, "channels.csv"))}

    idiomas = defaultdict(set)          # canal -> idiomas (todas sus señales)
    idioma_feed = {}                    # "canal@feed" -> idiomas
    for fd in leer_csv(os.path.join(datos, "feeds.csv")):
        langs = set(filter(None, fd["languages"].split(";")))
        idiomas[fd["channel"]] |= langs
        idioma_feed[f'{fd["channel"]}@{fd["id"]}'] = langs

    logos = {}
    for lg in leer_csv(os.path.join(datos, "logos.csv")):
        clave = f'{lg["channel"]}@{lg["feed"]}' if lg["feed"] else lg["channel"]
        if clave not in logos:
            logos[clave] = lg["url"]

    carpetas = defaultdict(list)       # nombre de carpeta -> entradas
    streams_dir = os.path.join(iptv_dir, "streams")

    for archivo in sorted(os.listdir(streams_dir)):
        if not archivo.endswith(".m3u"):
            continue
        pais_archivo = archivo.split("_")[0].split(".")[0].upper()
        for e in parsear_m3u(os.path.join(streams_dir, archivo)):
            canal_id = e["tvg_id"].split("@")[0]
            info = canales.get(canal_id, {})
            pais = info.get("country") or pais_archivo
            cats = set(filter(None, info.get("categories", "").split(";")))
            langs = idioma_feed.get(e["tvg_id"]) or idiomas.get(canal_id, set())
            nombre = e["nombre"]
            nombre_base = re.sub(r"\s*[\(\[].*$", "", nombre).strip().lower()

            # Categoría interna
            sub = "Otros"
            for cat, carpeta in CATEGORIA_CARPETA:
                if cat in cats:
                    sub = carpeta
                    break
            if not cats:
                sub = "General"  # sin categoría: casi siempre canales locales
            if DEPORTES.search(nombre_base) and sub in ("Otros", "General", "Entretenimiento"):
                sub = "Deportes"
            if MOTOR.search(nombre) and sub in ("Deportes", "Otros", "General", "Motor",
                                                "Entretenimiento"):
                sub = "Motor"

            e["logo"] = logos.get(e["tvg_id"]) or logos.get(canal_id, "")
            e["q"] = calidad(nombre)

            destinos = []
            if pais in PAISES_PRINCIPALES:
                pn = PAISES_PRINCIPALES[pais]
                s = sub
                if pais == "ES" and re.search(TDT_ESPANA, nombre_base, re.I):
                    s = "TDT Nacional" if not re.search(
                        r"(canal sur|telemadrid|punt|cmm|aragon|ib3|tpa|extremadura|tvcan|canaria|"
                        r"etb|tv3|el 33|esport3|3cat|7rm|tvg|la 7)", nombre_base) else "Autonómicos"
                elif sub == "General":
                    pat = NACIONALES.get(pais)
                    s = "Nacionales" if pat and re.search(pat, nombre_base, re.I) else "Regionales y Locales"
                elif pais in NACIONALES and re.search(NACIONALES[pais], nombre_base, re.I) \
                        and sub in ("Otros", "Entretenimiento"):
                    s = "Nacionales"
                destinos.append(f"{pn} | {s}")
                if sub == "Motor":
                    destinos.append("Fórmula 1 y Motor")
            elif pais in PAISES_LATAM:
                destinos.append(f"Latinoamérica | {PAISES_LATAM[pais]}")
                if sub == "Motor":
                    destinos.append("Fórmula 1 y Motor")
                elif sub in ("Deportes",):
                    destinos.append("Deportes Internacional")
            else:
                for tema, cat_int, lang in TEMATICOS:
                    if sub == cat_int and (lang is None or lang in langs):
                        destinos.append(tema)
                        break

            for d in destinos:
                carpetas[d].append(e)

    # ------------------------------------------------------------ escribir
    os.makedirs(SALIDA, exist_ok=True)

    def ordenar_grupos(prefijo):
        grupos = [g for g in carpetas if g.startswith(prefijo + " | ")]
        return sorted(grupos, key=lambda g: (ORDEN_SUB.index(g.split(" | ")[1])
                                             if g.split(" | ")[1] in ORDEN_SUB else 99))

    bloques = {
        "chile": ordenar_grupos("Chile"),
        "argentina": ordenar_grupos("Argentina"),
        "espana": ordenar_grupos("España"),
        "mexico": ordenar_grupos("México"),
        "latam": sorted(g for g in carpetas if g.startswith("Latinoamérica | ")),
        "tematicos": [t for t, _, _ in TEMATICOS if t in carpetas],
    }

    def escribir(ruta, grupos):
        total, vistos_global = 0, set()
        with open(ruta, "w", encoding="utf-8") as f:
            f.write("#EXTM3U\n")
            for g in grupos:
                vistos = set()
                for e in sorted(carpetas[g], key=lambda x: (re.sub(r"\s*[\(\[].*$", "", x["nombre"]).lower(),
                                                            -x["q"])):
                    if e["url"] in vistos:
                        continue
                    vistos.add(e["url"])
                    attrs = f'tvg-id="{e["tvg_id"]}"'
                    if e["logo"]:
                        attrs += f' tvg-logo="{e["logo"]}"'
                    for k, v in e["extra"].items():
                        attrs += f' {k}="{v}"'
                    attrs += f' group-title="{g}"'
                    f.write(f'#EXTINF:-1 {attrs},{e["nombre"]}\n')
                    for o in e["opts"]:
                        f.write(o + "\n")
                    f.write(e["url"] + "\n")
                    total += 1
        return total

    resumen = []
    todos = []
    for nombre, grupos in bloques.items():
        n = escribir(os.path.join(SALIDA, f"{nombre}.m3u"), grupos)
        todos += grupos
        resumen.append((nombre, n))
    n_total = escribir(os.path.join(SALIDA, "canales_ordenados.m3u"), todos)

    with open(os.path.join(SALIDA, "CARPETAS.md"), "w", encoding="utf-8") as f:
        f.write("# Carpetas generadas\n\n| Carpeta | Canales |\n|---|---:|\n")
        for g in todos:
            f.write(f"| {g} | {len({e['url'] for e in carpetas[g]})} |\n")
        f.write(f"\n**Total entradas en canales_ordenados.m3u:** {n_total}\n")

    for nombre, n in resumen:
        print(f"{nombre:12s} {n:6d}")
    print(f"{'TOTAL':12s} {n_total:6d}")


if __name__ == "__main__":
    sys.exit(main())
