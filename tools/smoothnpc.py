# NPC 그림의 머리카락 윤곽을 다듬는다 — tools/smoothnpc.js 가 부른다 (손으로 부르지 않는다)
#   python3 -I tools/smoothnpc.py <작업 폴더>
# 작업 폴더의 <id>.png(지금 npcart 의 그림을 SCALE 배로 «앤티에일리어싱 없이» 찍은 것)와 <id>.json(팔레트·머리색·살색)을 읽어
# 같은 폴더에 <id>.svg 를 쓴다.
#   ① 픽셀마다 팔레트 번호(라벨)를 매긴다
#   ② 머리색 라벨만 «가우시안 다수결»로 다듬는다 — 라벨마다 지시 함수를 흐려 제일 큰 것을 고른다.
#      바뀌는 자리는 「머리 ↔ 머리·살·바탕」 사이뿐이다 (가는 활시위·바이올린 활이 머리에 먹히지 않게)
#   ③ 층을 다시 딴다 — k번째 층은 «k번째 이후 라벨 전부»의 합집합이라, 위 층의 가장자리는 늘 아래 층의 «안»에 선다
#      (조각끼리 맞닿는 이음매가 없어 그 사이로 밑의 색이 실처럼 비치지 않는다 — 오릭스 얼굴의 「실」이 그것이었다)
import sys, os, json
import numpy as np
import cv2

work = sys.argv[1]
for name in sorted(os.listdir(work)):
    if not name.endswith('.json'): continue
    meta = json.load(open(os.path.join(work, name)))
    S = meta['scale']; pal = meta['pal']; hair = set(meta['hair'])
    im = cv2.imread(os.path.join(work, meta['id'] + '.png'), cv2.IMREAD_UNCHANGED)  # BGRA
    H, W = im.shape[:2]
    P = np.array([[int(c[5:7], 16), int(c[3:5], 16), int(c[1:3], 16)] for c in pal], np.int32)
    d = ((im[:, :, None, :3].astype(np.int32) - P[None, None]) ** 2).sum(-1)
    lab = d.argmin(-1).astype(np.int32) + 1
    lab[im[:, :, 3] < 128] = 0
    # 살색 = 얼굴 가운데(두 눈과 입 사이)의 색
    F = meta['face']; skin = pal[lab[int((F['ey'] + F['my']) / 2 * S), int(F['cx'] * S)] - 1]
    # ② 모든 경계를 한 번 다듬는다 (귀·망치·옷 가장자리의 작은 톱니) — 단 «가는 것»은 얼린다:
    #    한 덩어리 안에서 가장자리까지 제일 먼 거리가 THIN 보다 짧으면(활시위·바이올린 활·띠) 그 칸은 안 바꾼다
    frozen = np.zeros(lab.shape, bool)
    for k in range(len(pal) + 1):
        m = (lab == k).astype(np.uint8)
        if not m.any(): continue
        nc, cc = cv2.connectedComponents(m, connectivity=8)
        dt = cv2.distanceTransform(m, cv2.DIST_L2, 5)
        mx = np.zeros(nc, np.float32); np.maximum.at(mx, cc.ravel(), dt.ravel())
        area = np.bincount(cc.ravel(), minlength=nc)
        # ⚠️ 작은 «티»는 얼리지 않는다 — 가늘어도 길이가 없으면(넓이 SPECK 아래) 선이 아니라 따다 남은 부스러기다
        frozen |= (m > 0) & (mx[cc] < meta['thin'] * S) & (area[cc] >= meta['speck'] * S * S)
    allk = [k for k in range(len(pal) + 1) if (lab == k).any()]
    score = np.stack([cv2.GaussianBlur((lab == k).astype(np.float32), (0, 0), meta['gsigma'] * S) for k in allk])
    best = np.array(allk)[score.argmax(0)]
    lab0 = lab.copy()
    lab = np.where(frozen, lab, best)
    # ②-2 «티» 메우기 — 넓이가 FLECK 아래인 덩어리는 둘레에서 제일 많이 닿은 색으로 바꾼다
    #      (머리 윤곽에 붙은 중간색 부스러기 · 다수결이 못 지운 몇 픽셀짜리 섬). 얼린 것(가는 선)은 그대로다
    kern = np.ones((3, 3), np.uint8)
    hid0 = {i + 1 for i, c in enumerate(pal) if c in hair}
    for _ in range(2):
        for k in range(len(pal) + 1):
            m = (lab == k).astype(np.uint8)
            if not m.any(): continue
            nc, cc, st, _c = cv2.connectedComponentsWithStats(m, connectivity=8)
            for c in range(1, nc):
                if k in hid0 or st[c, cv2.CC_STAT_AREA] >= meta['fleck'] * 6 * S * S: continue
                x, y, w, h = st[c, :4]
                x0, y0, x1, y1 = max(0, x - 2), max(0, y - 2), min(W, x + w + 2), min(H, y + h + 2)
                blob = (cc[y0:y1, x0:x1] == c)
                if (blob & frozen[y0:y1, x0:x1]).any(): continue
                ring = cv2.dilate(blob.astype(np.uint8), kern).astype(bool) & ~blob
                nb = lab[y0:y1, x0:x1][ring]
                if not len(nb): continue
                # 큰 쪽(FLECK × 6 까지)은 «머리와 바탕 사이에만» 낀 조각일 때만 — 머리 끝에 남은 중간색 테두리다
                if st[c, cv2.CC_STAT_AREA] >= meta['fleck'] * S * S and not np.isin(nb, list(hid0) + [0]).all(): continue
                sub = lab[y0:y1, x0:x1]; sub[blob] = np.bincount(nb).argmax()
    # ③ 머리색은 한 번 더, 더 크게 다듬는다
    sig = meta['sigma'] * S
    hid = [i + 1 for i, c in enumerate(pal) if c in hair]
    sid = [i + 1 for i, c in enumerate(pal) if c == skin]
    soft = set(hid) | set(sid) | {0}
    cand = sorted(soft)
    score = np.stack([cv2.GaussianBlur((lab == k).astype(np.float32), (0, 0), sig) for k in cand])
    best = np.array(cand)[score.argmax(0)]
    hs = np.isin(lab, hid) | np.isin(best, hid)
    ok = np.isin(lab, cand) & hs
    lab2 = np.where(ok & ~frozen, best, lab)
    # ③-2 손으로 짚은 조각 메우기 (smoothnpc.js 의 MEND) — 머리색이어도 · 얼었어도 메운다
    for px, py in meta.get('mend', []):
        y, x = int(py * S), int(px * S)
        k = lab2[y, x]
        nc, cc = cv2.connectedComponents((lab2 == k).astype(np.uint8), connectivity=8)
        blob = cc == cc[y, x]
        if blob.sum() > meta['fleck'] * 8 * S * S: raise SystemExit('%s 의 메울 점 (%g, %g) 이 너무 큰 덩어리를 짚었다' % (meta['id'], px, py))
        ring = cv2.dilate(blob.astype(np.uint8), kern).astype(bool) & ~blob
        lab2[blob] = np.bincount(lab2[ring]).argmax()
    # ④ 층 순서 — 칠한 넓이가 큰 색이 아래
    cnt = np.bincount(lab2.ravel(), minlength=len(pal) + 1)
    order = sorted([k for k in range(1, len(pal) + 1) if cnt[k]], key=lambda k: (-cnt[k], k))
    out = []
    for i, k in enumerate(order):
        # ⚠️ 위 층의 칸이 이 층 «바깥 테두리»에 닿는 자리는 INSET 만큼 안으로 물린다 — 두 층의 테두리가 같은 자리를
        #    지나면 따로 다듬어져 아래 층이 위 층 밖으로 실처럼 삐져나온다 (오릭스의 귀·망치·손 둘레가 그랬다).
        #    물린 칸은 위 층이 제 색으로 덮으므로 빈 데가 안 생긴다
        full = np.isin(lab2, order[i:]).astype(np.uint8)
        r = max(1, int(round(meta['inset'] * S)))
        er = cv2.erode(full, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
        m = ((lab2 == k) | (np.isin(lab2, order[i + 1:]) & (er > 0))).astype(np.float32)
        #    물린 자리의 이음매에 남는 작은 뾰족한 끝을 한 번 흐려 문턱으로 다시 자른다 (모서리만 둥글어진다)
        #    ⚠️ 가는 선(얼린 칸)은 흐리면 끊기므로 제 색 그대로 다시 얹는다 (슈타르크의 활시위가 끊겼다)
        own = (lab2 == k).astype(np.uint8)
        dto = cv2.distanceTransform(own, cv2.DIST_L2, 5)
        nc, cc = cv2.connectedComponents(own, connectivity=8)
        thick = np.zeros(nc, np.float32); np.maximum.at(thick, cc.ravel(), dto.ravel())
        thin = (own > 0) & (thick[cc] < 2 * r)
        m = ((cv2.GaussianBlur(m, (0, 0), r) > 0.5) | thin | ((lab2 == k) & frozen)).astype(np.uint8)
        # 색마다 더 크게 다듬을 몫(smoothnpc.js 의 SOFT · [닫는 반지름, 흐리는 σ]) — 가는 선까지 한 번 더 흐려 자른다 (문턱을 조금 낮춰 안 끊기게)
        sk = meta.get('soft', {}).get(pal[k - 1])
        #    덩어리마다 먼저 «닫아» 오목하게 파인 홈을 메우고 나서 흐린다 — 흐리기만 하면 홈 자리에서 띠가 끊긴다.
        #    ⚠️ 덩어리마다 따로 닫는다 — 통째로 닫으면 두 다리처럼 나란한 덩어리 사이가 메워진다
        if sk:
            q = int(round(sk[0] * S)); ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * q + 1, 2 * q + 1))
            nc2, cc2 = cv2.connectedComponents(m, connectivity=8)
            acc = np.zeros_like(m)
            for c2 in range(1, nc2):
                one = (cc2 == c2).astype(np.uint8)
                if q: one = cv2.morphologyEx(one, cv2.MORPH_CLOSE, ker)
                acc |= (cv2.GaussianBlur(one.astype(np.float32), (0, 0), sk[1] * S) > 0.45).astype(np.uint8)
            m = acc
        m = m * 255
        cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        if hier is None: continue
        parts = []
        for j, c in enumerate(cs):
            c = c[:, 0, :].astype(np.float64) + 0.5
            if len(c) < 8: continue
            # 계단 펴기 — Taubin(λ/μ)으로 부피를 지키며 몇 번만
            for _ in range(meta['iter']):
                for f in (0.5, -0.53):
                    c = c + f * ((np.roll(c, 1, 0) + np.roll(c, -1, 0)) / 2 - c)
            c = cv2.approxPolyDP(c.astype(np.float32).reshape(-1, 1, 2), meta['eps'], True)[:, 0, :] / S
            if len(c) < 3: continue
            a = 0.5 * np.sum(c[:, 0] * np.roll(c[:, 1], -1) - np.roll(c[:, 0], -1) * c[:, 1])
            hole = hier[0][j][3] >= 0
            if abs(a) < 0.3: continue
            if (a < 0) != hole: c = c[::-1]   # 바깥은 한쪽으로, 구멍은 반대로 (nonzero 로 뚫린다)
            # 꼭짓점을 «제어점»으로 두고 이웃 사이의 가운데 점을 지나는 2차 곡선으로 잇는다 — 꺾인 데가 안 남는다
            f = lambda v: '%g' % round(float(v), 1)
            mid = (c + np.roll(c, -1, 0)) / 2
            parts.append('M%s %s' % (f(mid[-1][0]), f(mid[-1][1])) + ''.join('Q%s %s %s %s' % (f(c[q][0]), f(c[q][1]), f(mid[q][0]), f(mid[q][1])) for q in range(len(c))) + 'Z')
        if parts: out.append('<path d="%s" fill="%s"/>' % (''.join(parts), pal[k - 1]))
    # 살색은 루트에 적어 둔다 — portrait.js 가 그 조각 위에 턱 밑 그늘을 얹는다 (gennpc 가 읽는다)
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %g %g" data-skin="%s">%s</svg>\n' % (meta['w'], meta['h'], skin, ''.join(out))
    open(os.path.join(work, meta['id'] + '.svg'), 'w').write(svg)
    print(meta['id'], len(out), '층', '%dKB' % (len(svg) // 1024), '머리 바뀐 칸 %d' % int((lab2 != lab0).sum()))
