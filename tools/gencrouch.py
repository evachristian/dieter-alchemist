#!/usr/bin/env python3
# 「혼자 먹은 밤」의 웅크린 뒷모습 — 사람이 보낸 그림을 «대고 따라 그려» crouchart.js 로 굽는다.
#
#   pip install vtracer pillow numpy
#   python3 -I tools/gencrouch.py <갈래> <받은 PNG> crouchart.js
#
#   갈래 = 뒷머리 «전체 실루엣»마다 한 장: long(기본 · 반묶음) · twin(양갈래) · bob(단발)
#   이미 있는 crouchart.js 의 다른 갈래는 그대로 두고 그 갈래만 갈아 끼운다.
#
# ⚠️⚠️ **그림에서 바로 따면 색을 못 갈아 끼운다.** 가장자리마다 섞인 색(머리+옷 = 카키 등)이
#    수십 가지 생겨, 어느 것이 «옷»이고 어느 것이 «머리»인지 정할 수가 없다.
#    그래서 ① 픽셀마다 **역할 팔레트**의 제일 가까운 색으로 먼저 눌러 놓고 ② 그것을 따고
#    ③ 따인 조각마다 역할을 붙인다. 역할이 있어야 avatar.js 가 착장의 색으로 갈아 칠한다.
#    팔레트는 그림마다 다르다 — **k-means 로 재서** 골랐다 (짐작으로 고르지 않는다)
# ⚠️ 케이크 색은 **케이크 상자 안에서만** 쓴다 — 밖에서 쓰면 살·크림이 서로 넘나든다.
#    부스러기 자리에서만 스펀지 색을 하나 더 허락한다.
# ⚠️⚠️ 케이크 상자 안의 살색 조각은 «손 · 얼굴 · (살색과 비슷한) 케이크» 셋 중 하나다.
#    **손 상자 «안에 다 들어오는» 조각만 손이다** — 가운데만 보고 정했더니 케이크 밑면의
#    그늘선(손 상자에 걸친 넓은 조각)이 «손의 선»이 되어, 이모지로 바꿨을 때 음식 옆에
#    **그릇 실루엣**처럼 남았다 (신고받았다).
import sys, re, json, os
import numpy as np
from PIL import Image
import vtracer
from PIL import ImageFilter

H = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
CAKE_ROLES = ('sponge', 'cream', 'cakeL', 'straw', 'leaf')
VARIANTS = {
    # 반묶음 긴 머리 · 초록 원피스 (원피스라 «아랫도리» 색이 따로 없다 — 허리에서 잘라 칠한다)
    'long': dict(
        pal={'bg': '#fefefe', 'hair': '#6f4a35', 'hairL': '#553119', 'cloth': '#7b965e',
             'clothL': '#5d7841', 'skin': '#fbd0b5', 'skinL': '#e0a080', 'shoe': '#3f3436',
             'sponge': '#f9a665', 'cream': '#fcecdc', 'straw': '#d33d49', 'leaf': '#6f953b'},
        cake=(240, 400, 412, 612), hand=(282, 526, 372, 602), face=(345, 380, 440, 440),
        skin_in_cake='cream', crumb=(0, 830, 330, 1024), keep=(355, 0, 1024, 475)),
    # 양갈래 · 살구색 상의 + 보라 치마
    'twin': dict(
        pal={'bg': '#fefefe', 'hair': '#fcea7a', 'hairL': '#e6d662', 'cloth': '#fdd5a6',
             'clothL': '#e9bc8b', 'lower': '#c8b4fc', 'lowerL': '#a892d9', 'skin': '#fbd9c1',
             'skin2': '#f9c2a4',   # 쥔 손 — 얼굴보다 진해서 상의(#fdd5a6)에 더 가깝다. 따로 안 두면 손이 «옷»이 된다
             'skinL': '#e0a585', 'shoe': '#483d3e',
             'sponge': '#f39e69', 'cream': '#fcedda', 'straw': '#d33d49', 'leaf': '#6f953b'},
        cake=(240, 410, 412, 612), hand=(270, 520, 420, 625), face=None,
        cake_only=(258, 418, 398, 560),
        skin_in_cake='skin', crumb=(0, 830, 330, 1024), keep=(345, 0, 1024, 468), mode=3,
        skin_zone=[(290, 270, 525, 520), (260, 500, 425, 630), (380, 820, 720, 940)]),
    # 단발 · 하늘색 상의 + 민트 치마 (반소매라 팔이 맨살이다)
    'bob': dict(
        pal={'bg': '#fefefe', 'hair': '#dd302f', 'hairL': '#b7413f', 'cloth': '#d1e2fc',
             'clothL': '#b9cfec', 'lower': '#a6d6be', 'lowerL': '#8bc0a6', 'skin': '#fcd8c1',
             'skinL': '#f0bfa2', 'shoe': '#453a3e',
             'sponge': '#f5aa77', 'cream': '#fdf6f0', 'straw': '#d83e3e', 'leaf': '#66904a'},
        cake=(225, 460, 412, 660), hand=(250, 545, 430, 665), face=None,
        cake_only=(232, 465, 412, 602),
        skin_in_cake='skin', crumb=(0, 830, 350, 1024), keep=(375, 0, 1024, 520)),
    # 포니테일 · 하늘 상의 + 민트 치마 (반소매)
    'ponytail': dict(
        pal={'bg': '#fefefe', 'hair': '#885dd1', 'hairL': '#754cbe', 'cloth': '#cde0fa',
             'clothL': '#b4c4e4', 'lower': '#a5d4bc', 'lowerL': '#8dc1a6', 'skin': '#fbd8c0',
             'skinL': '#efb99c', 'shoe': '#463a40',
             'sponge': '#f8ba89', 'cream': '#f8ebe2', 'straw': '#cc5d5d', 'leaf': '#708c57'},
        cake=(225, 425, 425, 612), hand=(275, 540, 445, 665), face=None,
        cake_only=(232, 436, 416, 602), skin_in_cake='skin', crumb=(0, 820, 340, 1024),
        keep=(385, 0, 1024, 600)),
    # 웨이브 · 하늘 상의 + 민트 치마
    'wave': dict(
        pal={'bg': '#fefefe', 'hair': '#fd5ca0', 'hairL': '#e14a8a', 'cloth': '#cfe2fc',
             'clothL': '#b6cbe8', 'lower': '#a8d6bf', 'lowerL': '#8bbda5', 'skin': '#fcd9c2',
             'skinL': '#efb99c', 'shoe': '#41383d',
             'sponge': '#f8b483', 'cream': '#fdf3ea', 'straw': '#d15053', 'leaf': '#6e8f49'},
        cake=(205, 440, 400, 620), hand=(270, 540, 425, 655), face=None,
        cake_only=(212, 450, 385, 598), only_allow=('lower', 'lowerL'), skin_in_cake='skin', crumb=(0, 820, 340, 1024),
        keep=(380, 0, 1024, 520)),
    # 올림머리 · 하늘 상의 + 민트 치마 — ⚠️ 머리(민트)와 치마(민트)가 거의 같은 색이라
    #    **높이로 가른다**(zones): 머리는 어깨 위, 치마는 허리 아래에만 있다
    'bun': dict(
        pal={'bg': '#fefefe', 'hair': '#aae4cd', 'hairL': '#95c6b0', 'cloth': '#cee2fb',
             'clothL': '#b6cbe8', 'lower': '#a6d5be', 'lowerL': '#8bbfa6', 'skin': '#fcd9c0',
             'skinL': '#efb39a', 'shoe': '#4c4242',
             'sponge': '#f2ac83', 'cream': '#fcf1e4', 'straw': '#d24a4f', 'leaf': '#6e8f49'},
        cake=(225, 455, 412, 645), hand=(270, 570, 430, 670), face=None,
        cake_only=(230, 466, 402, 626), skin_in_cake='skin', crumb=(0, 840, 340, 1024),
        keep=(365, 0, 1024, 520),
        zones={'hair': [(0, 0, 1024, 515)], 'hairL': [(0, 0, 1024, 515)],
               'lower': [(0, 560, 1024, 1024)], 'lowerL': [(0, 560, 1024, 1024)]}),
}

variant, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
V = VARIANTS[variant]
names = list(V['pal'])
pal = np.array([H(V['pal'][k]) for k in names])
CAKE_BOX, CRUMB_BOX, HAND_BOX, FACE_BOX = V['cake'], V['crumb'], V['hand'], V['face']

im = np.asarray(Image.open(src).convert('RGB')).astype(int)
Hh, W, _ = im.shape
yy, xx = np.mgrid[0:Hh, 0:W]
inbox = lambda b: (xx >= b[0]) & (yy >= b[1]) & (xx <= b[2]) & (yy <= b[3])
cake, crumb = inbox(CAKE_BOX), inbox(CRUMB_BOX)
# ⚠️⚠️ **가장자리는 «흰 바탕 + 그 색»이 섞인 것이다** — 그냥 제일 가까운 색으로 누르면
#    노란 머리의 흰 테두리가 «살색»에 더 가까워 머리 둘레에 살색 테가 둘렸다(양갈래에서 봤다).
#    그래서 픽셀을 «흰색 → 그 색» 선분에 내려 놓고 ① 선분에서 얼마나 먼가로 색을 고르고
#    ② 그 색이 절반도 안 섞였으면(t < 0.5) 바탕으로 친다
WHITE = np.array(H(V['pal']['bg']))
vec = pal - WHITE                                      # 색마다 흰색에서의 방향
rel = im[:, :, None, :] - WHITE                         # 픽셀의 흰색에서의 자리
t = np.clip((rel * vec[None, None]).sum(-1) / np.maximum((vec ** 2).sum(-1), 1)[None, None], 0, 1)
# ⚠️ 선분에서의 거리«만» 보면 안 된다 — 옷과 옷선처럼 **같은 빛깔의 진하기만 다른 색**은
#    흰색에서 거의 같은 방향이라, 옷 픽셀이 «옷선을 덜 섞은 것»으로 읽혀 옷선이 된다.
#    그래서 «덜 섞인 몫»에도 값을 매긴다 (LAM — 섞인 테두리는 바탕으로 보내면서 순색끼리는 안 헷갈리는 자리)
LAM = 0.1
CREAM_GAP = 34                                          # 크림 층이 이보다 두꺼우면 크림이 아니라 바탕이다
d = ((rel - t[..., None] * vec[None, None]) ** 2).sum(-1) \
    + LAM * ((1 - t) ** 2) * (vec ** 2).sum(-1)[None, None]
for i, k in enumerate(names):
    if k in CAKE_ROLES:
        d[:, :, i] = np.where(cake | (crumb if k == 'sponge' else False), d[:, :, i], 10 ** 9)
# (only_allow — 치마가 상자 밑에 걸치는 그림은 치마 색을 허락한다. 안 그러면 치마가 «바탕»이 되어 뚫린다)
# ⚠️ 상의 색이 케이크와 닮은 그림(살구 · 하늘)에서는 케이크 몸통이 «옷»으로 읽힌다 —
#    그러면 이모지로 바꿨을 때 그 자리에 옷 색 케이크 실루엣이 남는다. 케이크만 있는 상자 안에서는
#    케이크 색과 살색(쥔 손)만 허락한다
if V.get('cake_only'):
    only = inbox(V['cake_only'])
    for i, k in enumerate(names):
        if k not in CAKE_ROLES and k not in ('bg', 'skin', 'skinL') and k not in V.get('only_allow', ()):
            d[:, :, i] = np.where(only, 10 ** 9, d[:, :, i])
# ⚠️ 살색이 상의(살구)와 닮은 그림은 상의와 치마가 맞닿은 자리의 섞인 한 줄이 «살색»으로
#    읽혀 허리에 밝은 실선이 남았다(양갈래). 살은 얼굴·손·발목에만 있다 — 그 밖에서는 안 쓴다
ZONES = dict(V.get('zones') or {})
if V.get('skin_zone'):
    ZONES['skin'] = ZONES['skinL'] = V['skin_zone']
for i, k in enumerate(names):
    boxes = ZONES.get(re.sub(r'\d+$', '', k))
    if boxes:
        zone = np.zeros((Hh, W), bool)
        for b in boxes:
            zone |= inbox(b)
        d[:, :, i] = np.where(zone, d[:, :, i], 10 ** 9)
bgi = names.index('bg')
d[:, :, bgi] = 10 ** 9                                 # 바탕은 «t 가 작다»로만 정한다
idx = d.argmin(-1)
tt = np.take_along_axis(t, idx[..., None], -1)[..., 0]
idx = np.where(tt < 0.5, bgi, idx)
# ⚠️ 두 색이 맞닿은 자리의 섞인 한 줄(살구 상의 + 보라 치마 = 살색에 가깝다)이 «살색 실선»으로
#    남는다(양갈래에서 봤다). 그 그림만 최빈값 거르개로 1px 짜리 띠를 지운다 — 선(3px 넘음)은 산다
if V.get('mode'):
    qi = Image.fromarray(idx.astype(np.uint8)).filter(ImageFilter.ModeFilter(V['mode']))
    idx = np.asarray(qi).astype(idx.dtype)
# ⚠️⚠️ **케이크의 크림은 흰 바탕과 거의 같은 색이다** — 그대로 두면 크림 층이 «바탕»으로 읽혀
#    케이크 «안»이 뚫리고(어두운 방이 비친다), 가장자리의 섞인 한 줄은 «크림 테»가 되어
#    케이크가 조각조각 깨져 보였다 (웨이브에서 신고받았다). 그래서 케이크 상자 안의 크림을
#    한 번 다 지우고, **세로로 케이크 조각 «사이»에 낀 빈칸만** 크림으로 되살린다
#    (스펀지 사이의 크림 층 · 딸기 밑의 생크림). 위가 트인 «베어 문 자국»은 안 메워진다
ci = names.index('cream')
CK = [names.index(k) for k in ('sponge', 'cakeL', 'straw', 'leaf') if k in names]
x0c, y0c, x1c, y1c = CAKE_BOX
# ⚠️ 크림과 스펀지가 맞닿은 섞인 줄은 «살선»으로 읽힌다 — 케이크만 있는 상자 안에서는 그것도 빈칸으로 친다
GAPOK = [bgi] + [names.index(k) for k in ('skin', 'skinL') if k in names]
only_b = V.get('cake_only') or CAKE_BOX
for x in range(x0c, x1c + 1):
    col = idx[y0c:y1c + 1, x]
    col[col == ci] = bgi
    solid = np.where(np.isin(col, CK))[0]
    for a, b in zip(solid[:-1], solid[1:]):
        if not (1 < b - a <= CREAM_GAP):
            continue
        gap = col[a + 1:b]
        loose_ok = only_b[0] <= x <= only_b[2] and y0c + b <= only_b[3]
        if (gap == bgi).all() or (loose_ok and np.isin(gap, GAPOK).all()):
            col[a + 1:b] = ci
# ⚠️ 스펀지가 흰 바탕과 섞인 한 줄은 «살색»으로 읽혀 케이크 둘레에 밝은 테가 둘렸다 —
#    케이크만 있는 상자 안에서 바탕과 스펀지 «사이»에 낀 살색은 바탕으로 보낸다
dil = lambda m, n: np.asarray(Image.fromarray(np.where(m, 255, 0).astype(np.uint8))
                              .filter(ImageFilter.MaxFilter(n))) > 0
SK = [names.index(k) for k in ('skin', 'skinL') if k in names]
rim = np.isin(idx, SK) & inbox(only_b) & dil(idx == bgi, 7) & dil(np.isin(idx, CK + [ci]), 7)
idx = np.where(rim, bgi, idx)
# ⚠️ 케이크의 «옅은 옆면»(포니테일)도 살색으로 읽혔다 — 케이크만 있는 상자 안의 살색 중
#    **손·얼굴과 이어지지 않은 것**은 케이크(크림)다. 손 상자의 굵은 살과 볼(keep)에서 퍼뜨려 가른다
if V.get('cake_only'):
    skin_all = np.isin(idx, SK)
    core = (skin_all & inbox(HAND_BOX)) & ~dil(~(skin_all & inbox(HAND_BOX)), 9)
    reach = core | (skin_all & inbox(V['keep'] or (0, 0, 0, 0)) & ~inbox(only_b))
    for _ in range(300):
        g = dil(reach, 3) & skin_all
        if (g == reach).all():
            break
        reach = g
    idx = np.where(skin_all & inbox(only_b) & ~reach, ci, idx)
# 가로로도 한 번 — 크림 층 «안»의 실금, 옅은 옆면(포니테일)이 바탕과 갈라진 틈(13px 이하)
for y in range(only_b[1], only_b[3] + 1):
    row = idx[y, only_b[0]:only_b[2] + 1]
    solid = np.where(np.isin(row, CK + [ci]))[0]
    for a, b in zip(solid[:-1], solid[1:]):
        if 1 < b - a <= 14 and (row[a + 1:b] == bgi).all():
            row[a + 1:b] = ci
# ⚠️⚠️ **선 색(…L)이 바탕에 닿는 자리는 선이 아니라 «섞인 테두리»다** — 머리 둘레에 1px 짜리
#    진한 테가 수십 조각으로 따여 «픽셀이 깨진» 것처럼 보였다. 바탕 옆 2px 안의 선 색은 제 바탕색으로
LINE = {names.index(k): names.index(k[:-1]) for k in names if k.endswith('L') and k[:-1] in names}
near_bg = np.asarray(Image.fromarray(np.where(idx == bgi, 0, 255).astype(np.uint8))
                     .filter(ImageFilter.MinFilter(5))) == 0
for li, bi in LINE.items():
    idx = np.where((idx == li) & near_bg, bi, idx)
# ⚠️⚠️ **1024 그대로 따면 경계가 계단이다** — 픽셀마다 역할을 하나씩 찍은 그림이라 경계가
#    1px 계단이고, 그것을 곡선으로 따면 머리카락·케이크 둘레가 자글자글하다. 역할마다 2배로
#    늘려 흐린 뒤 다시 고르면(UP) 계단이 둥글게 펴지고 1px 짜리 티끌도 같이 사라진다.
#    따낸 좌표는 1/UP 로 되돌린다
UP = int(os.environ.get('CROUCH_UP', '2'))
lab = np.zeros((Hh * UP, W * UP), np.uint8); best = np.full((Hh * UP, W * UP), -1, np.int16)
for i in np.unique(idx):
    ch = Image.fromarray(np.where(idx == i, 255, 0).astype(np.uint8)) \
        .resize((W * UP, Hh * UP), Image.BILINEAR).filter(ImageFilter.GaussianBlur(0.8 * UP))
    a = np.asarray(ch).astype(np.int16)
    m = a > best
    lab[m] = i; best[m] = a[m]
Image.fromarray(pal[lab].astype(np.uint8)).save('/tmp/_crouch_q.png')

vtracer.convert_image_to_svg_py('/tmp/_crouch_q.png', '/tmp/_crouch_q.svg', colormode='color',
    hierarchical='stacked', mode='spline', filter_speckle=4 * UP * UP, color_precision=8, layer_difference=1,
    corner_threshold=60, length_threshold=3.0 * UP, max_iterations=10, splice_threshold=45, path_precision=1 if UP == 1 else 0)
svg = open('/tmp/_crouch_q.svg').read()
inside = lambda b, x0, y0, x1, y1: b[0] <= x0 and b[1] <= y0 and x1 <= b[2] and y1 <= b[3]
within = lambda b, x, y: b is not None and b[0] <= x <= b[2] and b[1] <= y <= b[3]

parts = []
pat = r'<path d="([^"]*)" fill="#([0-9A-Fa-f]{6})"(?: transform="translate\(([-\d.]+),([-\d.]+)\)")?/>'
for d_, f, tx, ty in re.findall(pat, svg):
    tx, ty = float(tx or 0), float(ty or 0)
    rgb = np.array([int(f[i:i + 2], 16) for i in (0, 2, 4)])
    nums = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', d_)]
    xs, ys = [(v + tx) / UP for v in nums[0::2]], [(v + ty) / UP for v in nums[1::2]]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    in_cake, in_crumb = within(CAKE_BOX, cx, cy), within(CRUMB_BOX, cx, cy)
    ok = [k for k in names if k not in CAKE_ROLES or in_cake or (k == 'sponge' and in_crumb)]
    role = re.sub(r'\d+$', '', min(ok, key=lambda k: ((pal[names.index(k)] - rgb) ** 2).sum()))
    if role == 'bg':
        continue
    if role in ('skin', 'skinL') and in_cake:
        if inside(HAND_BOX, x0, y0, x1, y1):
            role = 'hand' if role == 'skin' else 'handL'
        elif within(FACE_BOX, cx, cy) or V['skin_in_cake'] == 'skin':
            pass                                  # 얼굴 (볼의 씹는 자국 등)
        else:
            role = 'cream' if role == 'skin' else 'cakeL'
    # 부스러기 상자 안의 것은 «다» 부스러기다 — 주황 부스러기가 상의선(살구) 쪽으로 읽혀
    #    옷 색(초록)으로 칠해진 적이 있다 (양갈래)
    if in_crumb:
        role = 'crumb'
    k = [0]
    def bake(m):
        v = (float(m.group(0)) + (tx if k[0] % 2 == 0 else ty)) / UP; k[0] += 1
        return ('%.1f' % v).rstrip('0').rstrip('.')
    parts.append([role, re.sub(r'-?\d+(?:\.\d+)?', bake, d_).replace(' Z ', 'Z').strip()])

# ── 케이크가 아닌 음식일 때 쓰는 두 겹 ─────────────────────────────
# ⚠️⚠️ 받은 그림은 «겹쳐 쌓은» 조각이라, 케이크 밑에 **케이크 모양의 살색·옷색 바탕**이 깔려
#    있다. 케이크 조각만 빼면 그 바탕이 음식 이모지 옆에 «그릇 실루엣»으로 남는다 (신고받았다).
#    조각을 골라 빼면 손까지 같이 빠진다(손이 그 바탕의 일부다). 그래서:
#    ① hole — 케이크 자리(+3px)를 몸 그림에서 «뚫는» 모양 (avatar.js 가 mask 로 쓴다)
#    ② hand — 쥔 손만 따로 딴 조각. 이모지 «위»에 다시 얹어 음식을 쥐게 한다
from PIL import ImageFilter
cake_px = np.isin(idx, [names.index(k) for k in CAKE_ROLES if k in names]) & cake
SKINS = [i for i, k in enumerate(names) if re.sub(r'\d+$', '', k) == 'skin']
skin_px = np.isin(idx, SKINS + [names.index('skinL')])
hand_px = skin_px & inbox(HAND_BOX)
loose = skin_px & ~hand_px & (inbox(V['cake_only']) if V.get('cake_only') else cake)
if FACE_BOX is not None:
    loose &= ~inbox(FACE_BOX)
hole = cake_px | (loose if V['skin_in_cake'] != 'skin' or V.get('cake_only') else False)
# ⚠️ 케이크가 «볼»을 가리던 자리는 뚫지 않는다 — 뚫으면 얼굴이 입가에서 이 빠진 것처럼 패인다.
#    그 밑에 깔린 바탕이 곧 볼이라, 케이크 조각만 빼면 볼이 드러난다
if V.get('keep'):
    hole &= ~inbox(V['keep'])
hole_im = Image.fromarray(np.where(hole, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(13))
hole_im.convert('RGB').save('/tmp/_crouch_hole.png')
vtracer.convert_image_to_svg_py('/tmp/_crouch_hole.png', '/tmp/_crouch_hole.svg', colormode='binary',
    mode='spline', filter_speckle=8, corner_threshold=60, length_threshold=4.0, splice_threshold=45, path_precision=1)

def baked(svgtext):
    out_ = []
    for d_, f, tx, ty in re.findall(r'<path d="([^"]*)" fill="#([0-9A-Fa-f]{6})"(?: transform="translate\(([-\d.]+),([-\d.]+)\)")?/>', svgtext):
        tx, ty = float(tx or 0), float(ty or 0)
        k = [0]
        def bake(m):
            v = float(m.group(0)) + (tx if k[0] % 2 == 0 else ty); k[0] += 1
            return ('%.1f' % v).rstrip('0').rstrip('.')
        out_.append((f, re.sub(r'-?\d+(?:\.\d+)?', bake, d_).replace(' Z ', 'Z').strip()))
    return out_
holes = [dd for f, dd in baked(open('/tmp/_crouch_hole.svg').read()) if f.upper() == '000000']

# ⚠️⚠️ 케이크가 가리던 «얼굴»은 받은 그림에 아예 없다 — 뚫기만 하면 입가·볼이 이 빠진 것처럼
#    패여 어두운 방이 비쳤다 (빵을 쥐었을 때 신고받았다). 손보다 위 줄마다 살이 시작하는 데부터
#    끝나는 데까지를 «얼굴»로 치고, 그중 뚫린 자리만 살색으로 메운다(face). 음식 이모지가 그 위에 온다
face_px = skin_px & (yy < HAND_BOX[1])
# ⚠️ «얼굴과 이어진» 살만 친다 — 케이크 가장자리에 남은 살색 한 점에서부터 줄을 채우면
#    케이크 폭 전체가 얼굴이 되어 음식 왼쪽에 살색 막대가 남았다. 볼(keep 상자)에서 퍼뜨린다
seed = face_px & inbox(V['keep'] or (0, 0, 1024, 1024))
for _ in range(300):
    grown = dil(seed, 3) & face_px
    if (grown == seed).all():
        break
    seed = grown
face_px = seed
fill = np.zeros_like(face_px)
for y in np.where(face_px.any(1))[0]:
    xs_ = np.where(face_px[y])[0]
    fill[y, xs_.min():xs_.max() + 1] = True
hole_wide = np.asarray(hole_im) == 0
patch = fill & hole_wide
Image.fromarray(np.where(patch, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5)) \
    .convert('RGB').save('/tmp/_crouch_face.png')
vtracer.convert_image_to_svg_py('/tmp/_crouch_face.png', '/tmp/_crouch_face.svg', colormode='binary',
    mode='spline', filter_speckle=8, corner_threshold=60, length_threshold=4.0, splice_threshold=45, path_precision=1)
faces = [dd for f, dd in baked(open('/tmp/_crouch_face.svg').read()) if f.upper() == '000000'] if patch.any() else []

# ⚠️ 손 겹에는 **살색 면만** 담는다 — 살선(skinL)은 손 상자에 걸친 케이크 밑면의 그늘선과
#    색이 같아, 담으면 음식 옆에 갈색 줄이 남는다 (단발에서 봤다)
hand_px = np.isin(idx, SKINS) & inbox(HAND_BOX)
# ⚠️ 케이크 밑면의 섞인 테두리도 «살색»으로 읽혀 손 상자 안에 실오라기로 남는다 — 이 겹은 이모지
#    «위»에 얹히므로 음식 옆에 흰 실금으로 보였다. 열기(줄였다 되늘리기)로 가는 것을 떼어 낸다
hand_px = ~dil(~hand_px, 7)                  # 침식
hand_px = dil(hand_px, 7) & np.isin(idx, SKINS)   # 되늘리기 (원래 살 안에서만)
hidx = np.where(hand_px, idx, bgi)
Image.fromarray(pal[hidx].astype(np.uint8)).save('/tmp/_crouch_hand.png')
vtracer.convert_image_to_svg_py('/tmp/_crouch_hand.png', '/tmp/_crouch_hand.svg', colormode='color',
    hierarchical='stacked', mode='spline', filter_speckle=4, color_precision=8, layer_difference=1,
    corner_threshold=60, length_threshold=4.0, max_iterations=10, splice_threshold=45, path_precision=1)
hands = []
for f, dd in baked(open('/tmp/_crouch_hand.svg').read()):
    rgb = np.array(H('#' + f))
    r = min(['bg'] + [names[i] for i in SKINS], key=lambda k: ((pal[names.index(k)] - rgb) ** 2).sum())
    if r != 'bg':
        hands.append(['hand', dd])

data = {'variants': {}}
if os.path.exists(out):
    m = re.search(r'window\.CrouchArt = (\{.*\});', open(out).read(), re.S)
    if m:
        old = json.loads(m.group(1))
        data['variants'] = old.get('variants') or ({'long': old['parts']} if 'parts' in old else {})
data['variants'][variant] = {'parts': parts, 'hole': holes, 'hand': hands, 'face': faces}
js = ('// ⚠️ 생성 파일이다 — 손으로 고치지 않는다. tools/gencrouch.py 가 굽는다.\n'
      '// 「혼자 먹은 밤」의 웅크린 뒷모습 (사람이 보낸 그림을 대고 따라 그린 것) → window.CrouchArt\n'
      '// 갈래는 뒷머리 «전체 실루엣»마다 한 장(long · twin · bob). 좌표는 받은 그림(1024×1024)\n'
      '// 그대로다. 조각마다 «역할»이 붙어 있어 avatar.js 의 crouchBack 이 착장 색으로 갈아 칠한다.\n'
      'window.CrouchArt = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(out, 'w').write(js)
from collections import Counter
print(variant, len(js), Counter(p[0] for p in parts), 'hole', len(holes), 'hand', len(hands), 'face', len(faces))
