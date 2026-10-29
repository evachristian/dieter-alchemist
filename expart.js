// ⚠️ 생성 파일 — 손으로 고치지 않는다 (node tools/genexpr.js · 원본 tools/ref/expr/*.svg)
// 둥근 표정 서른여덟. 160×160 캔버스 그대로이고, 얼굴에 앉히는 자리는 부르는 쪽이 정한다 → window.ExpArt
(function () {
  'use strict';
  const LIST = {
 "def": {
  "name": "기본",
  "brows": "",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M73 104 Q76 110 80 104 Q84 110 87 104\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "smile": {
  "name": "웃음",
  "brows": "",
  "eyes": "<path d=\"M49 77 Q58 61 67 77\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M93 77 Q102 61 111 77\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M73 103 Q80 113 87 103\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "warm": {
  "name": "다정",
  "brows": "",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M73 103 Q80 113 87 103\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "laugh": {
  "name": "크게웃음",
  "brows": "",
  "eyes": "<path d=\"M49 77 Q58 61 67 77\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M93 77 Q102 61 111 77\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M71 102 Q80 105 89 102 Q89 119 80 119 Q71 119 71 102 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"80\" cy=\"114\" rx=\"6\" ry=\"3.5\" fill=\"#EF9AAD\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "wink": {
  "name": "윙크",
  "brows": "",
  "eyes": "<path d=\"M49 77 Q58 61 67 77\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M73 104 Q76 110 80 104 Q84 110 87 104\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "proud": {
  "name": "우쭐",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 53 Q58 49 68 53 M92 53 Q102 49 112 53\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<path d=\"M47 73 Q47 90 58 90 Q69 90 69 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"62\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M46 73 Q58 75 70 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M91 73 Q91 90 102 90 Q113 90 113 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"106\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M90 73 Q102 75 114 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M74 108 Q83 113 88 103\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "smirk": {
  "name": "능글",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 48 Q58 40 68 48 M92 55 L112 53\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M74 108 Q83 113 88 103\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "flat": {
  "name": "무표정",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 53 Q58 49 68 53 M92 53 Q102 49 112 53\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M75 106 Q80 107 85 106\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"8\" ry=\"4\" fill=\"#F5D5D9\"/><ellipse cx=\"119\" cy=\"87\" rx=\"8\" ry=\"4\" fill=\"#F5D5D9\"/>"
 },
 "meh": {
  "name": "심드렁",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 53 Q58 49 68 53 M92 53 Q102 49 112 53\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<path d=\"M47 73 Q47 90 58 90 Q69 90 69 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"62\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M46 73 Q58 75 70 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M91 73 Q91 90 102 90 Q113 90 113 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"106\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M90 73 Q102 75 114 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M74 108 Q83 113 88 103\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "sleepy": {
  "name": "졸림",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 53 Q58 49 68 53 M92 53 Q102 49 112 53\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<path d=\"M49 73 Q58 84 67 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M93 73 Q102 84 111 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><ellipse cx=\"80\" cy=\"107\" rx=\"4.5\" ry=\"6.5\" fill=\"#AD6678\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "think": {
  "name": "생각중",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 53 Q58 49 68 53 M92 53 Q102 49 112 53\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<g transform=\"translate(0 -3)\"><ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/></g>",
  "mouth": "<g transform=\"translate(0 -8)\"><ellipse cx=\"80\" cy=\"107\" rx=\"4.5\" ry=\"6.5\" fill=\"#AD6678\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "doubt": {
  "name": "미심쩍음",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 48 Q58 40 68 48 M92 55 L112 53\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M74 108 Q83 113 88 103\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "shock": {
  "name": "놀람",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 46 Q58 38 68 46 M92 46 Q102 38 112 46\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><ellipse cx=\"80\" cy=\"108\" rx=\"7\" ry=\"10\" fill=\"#49363B\"/><ellipse cx=\"80\" cy=\"113\" rx=\"4\" ry=\"3\" fill=\"#E9A0AE\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "worry": {
  "name": "걱정",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 56 Q58 55 68 48 M92 48 Q102 55 112 56\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M70 108 Q73 102 77 108 Q80 114 83 108 Q87 102 90 108\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "sad": {
  "name": "슬픔",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 56 Q58 55 68 48 M92 48 Q102 55 112 56\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M74 109 Q80 100 86 109\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "cry": {
  "name": "울음",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 56 Q58 55 68 48 M92 48 Q102 55 112 56\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M70 108 Q73 102 77 108 Q80 114 83 108 Q87 102 90 108\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><path d=\"M44 88 Q36 100 40 107 Q44 111 48 106 Q51 101 44 88 M116 88 Q108 100 112 107 Q116 111 120 106 Q123 101 116 88\" fill=\"#B1DFEB\" stroke=\"#93CEE1\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
 },
 "angry": {
  "name": "화남",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 49 L68 57 M92 57 L112 49\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M74 109 Q80 100 86 109\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "grit": {
  "name": "참음",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 49 L68 57 M92 57 L112 49\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M73 106 Q76 103 80 106 Q84 109 87 106\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "cold": {
  "name": "차가움",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 53 Q58 49 68 53 M92 53 Q102 49 112 53\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<path d=\"M47 73 Q47 90 58 90 Q69 90 69 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"62\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M46 73 Q58 75 70 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M91 73 Q91 90 102 90 Q113 90 113 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"106\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M90 73 Q102 75 114 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M75 106 Q80 107 85 106\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"8\" ry=\"4\" fill=\"#F5D5D9\"/><ellipse cx=\"119\" cy=\"87\" rx=\"8\" ry=\"4\" fill=\"#F5D5D9\"/>"
 },
 "shy": {
  "name": "수줍음",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 56 Q58 55 68 48 M92 48 Q102 55 112 56\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<path d=\"M49 73 Q58 84 67 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M93 73 Q102 84 111 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><ellipse cx=\"80\" cy=\"107\" rx=\"4.5\" ry=\"6.5\" fill=\"#AD6678\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><path d=\"M35 85 l2 4 M41 84 l2 4 M115 85 l2 4 M121 84 l2 4\" fill=\"none\" stroke=\"#DC91A7\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
 },
 "ohh": {
  "name": "아하",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 46 Q58 38 68 46 M92 46 Q102 38 112 46\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><ellipse cx=\"80\" cy=\"107\" rx=\"4.5\" ry=\"6.5\" fill=\"#AD6678\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "star": {
  "name": "반짝기대",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 46 Q58 38 68 46 M92 46 Q102 38 112 46\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"13\" ry=\"13\" fill=\"#49363B\"/><path d=\"M58 65 Q60 73 67 76 Q60 79 58 87 Q56 79 49 76 Q56 73 58 65\" fill=\"#FFEDB0\" stroke=\"#FFEDB0\" stroke-width=\"0\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"102\" cy=\"76\" rx=\"13\" ry=\"13\" fill=\"#49363B\"/><path d=\"M102 65 Q104 73 111 76 Q104 79 102 87 Q100 79 93 76 Q100 73 102 65\" fill=\"#FFEDB0\" stroke=\"#FFEDB0\" stroke-width=\"0\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M71 102 Q80 105 89 102 Q89 119 80 119 Q71 119 71 102 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"80\" cy=\"114\" rx=\"6\" ry=\"3.5\" fill=\"#EF9AAD\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "love": {
  "name": "반함",
  "brows": "",
  "eyes": "<path d=\"M58 87 C33 72 46 57 58 69 C70 57 83 72 58 87\" fill=\"#e03040\" stroke=\"#e03040\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"53\" cy=\"69\" rx=\"3\" ry=\"2\" fill=\"#FFF9F3\"/><path d=\"M102 87 C77 72 90 57 102 69 C114 57 127 72 102 87\" fill=\"#e03040\" stroke=\"#e03040\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"97\" cy=\"69\" rx=\"3\" ry=\"2\" fill=\"#FFF9F3\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M71 102 Q80 105 89 102 Q89 119 80 119 Q71 119 71 102 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"80\" cy=\"114\" rx=\"6\" ry=\"3.5\" fill=\"#EF9AAD\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "faint": {
  "name": "질색기절",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 53 Q58 49 68 53 M92 53 Q102 49 112 53\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<path d=\"M50 68 L64 76 L50 84\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M110 68 L96 76 L110 84\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><ellipse cx=\"80\" cy=\"108\" rx=\"7\" ry=\"10\" fill=\"#49363B\"/><ellipse cx=\"80\" cy=\"113\" rx=\"4\" ry=\"3\" fill=\"#E9A0AE\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "haha": {
  "name": "박장대소",
  "brows": "",
  "eyes": "<path d=\"M50 68 L64 76 L50 84\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M110 68 L96 76 L110 84\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M71 102 Q80 105 89 102 Q89 119 80 119 Q71 119 71 102 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"80\" cy=\"114\" rx=\"6\" ry=\"3.5\" fill=\"#EF9AAD\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "tease": {
  "name": "메롱",
  "brows": "",
  "eyes": "<path d=\"M49 77 Q58 61 67 77\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M93 77 Q102 61 111 77\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M72 103 Q80 109 88 103\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M77 106 V112 Q81 119 85 112 V106\" fill=\"#ED9AAF\" stroke=\"#AD6678\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "pout": {
  "name": "삐죽토라짐",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 49 L68 57 M92 57 L112 49\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M76 104 Q88 104 81 109 Q88 114 76 113\" fill=\"none\" stroke=\"#AD6678\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "glare": {
  "name": "노려봄",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 49 L68 57 M92 57 L112 49\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<path d=\"M47 73 Q47 90 58 90 Q69 90 69 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"62\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M46 73 Q58 75 70 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M91 73 Q91 90 102 90 Q113 90 113 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"106\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M90 73 Q102 75 114 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M75 106 Q80 107 85 106\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"8\" ry=\"4\" fill=\"#F5D5D9\"/><ellipse cx=\"119\" cy=\"87\" rx=\"8\" ry=\"4\" fill=\"#F5D5D9\"/>"
 },
 "suspect": {
  "name": "흘김",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 48 Q58 40 68 48 M92 55 L112 53\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<path d=\"M47 73 Q47 90 58 90 Q69 90 69 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"62\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M46 73 Q58 75 70 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M91 73 Q91 90 102 90 Q113 90 113 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"106\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M90 73 Q102 75 114 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M74 108 Q83 113 88 103\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "dizzy": {
  "name": "어질어질",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 53 Q58 49 68 53 M92 53 Q102 49 112 53\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<path d=\"M58 75 c-2 -4 -7 -1 -5 3 c3 7 14 4 14 -4 c0 -13 -21 -13 -23 1\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M102 75 c-2 -4 -7 -1 -5 3 c3 7 14 4 14 -4 c0 -13 -21 -13 -23 1\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M70 108 Q73 102 77 108 Q80 114 83 108 Q87 102 90 108\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "weary": {
  "name": "지침",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 56 Q58 55 68 48 M92 48 Q102 55 112 56\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<path d=\"M47 73 Q47 90 58 90 Q69 90 69 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"62\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M46 73 Q58 75 70 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M91 73 Q91 90 102 90 Q113 90 113 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"106\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M90 73 Q102 75 114 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M75 106 Q80 107 85 106\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "relief": {
  "name": "안도",
  "brows": "",
  "eyes": "<path d=\"M49 73 Q58 84 67 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M93 73 Q102 84 111 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M73 103 Q80 113 87 103\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "sorry": {
  "name": "미안",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 56 Q58 55 68 48 M92 48 Q102 55 112 56\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M76 107 Q75 115 80 115 Q85 115 84 107 Z\" fill=\"#F0A8B7\" stroke=\"#49363B\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M70 103 C71 108 77 109 80 105 C83 109 89 108 90 103\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "plead": {
  "name": "부탁",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 56 Q58 55 68 48 M92 48 Q102 55 112 56\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"63\" cy=\"82\" rx=\"2.5\" ry=\"2.5\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"107\" cy=\"82\" rx=\"2.5\" ry=\"2.5\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><ellipse cx=\"80\" cy=\"107\" rx=\"4.5\" ry=\"6.5\" fill=\"#AD6678\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><path d=\"M35 85 l2 4 M41 84 l2 4 M115 85 l2 4 M121 84 l2 4\" fill=\"none\" stroke=\"#DC91A7\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
 },
 "blush": {
  "name": "부끄러움",
  "brows": "",
  "eyes": "<path d=\"M49 77 Q58 61 67 77\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M93 77 Q102 61 111 77\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M73 104 Q76 110 80 104 Q84 110 87 104\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><path d=\"M35 85 l2 4 M41 84 l2 4 M115 85 l2 4 M121 84 l2 4\" fill=\"none\" stroke=\"#DC91A7\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
 },
 "resolve": {
  "name": "결심",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 49 L68 57 M92 57 L112 49\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<path d=\"M47 73 Q47 90 58 90 Q69 90 69 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"62\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M46 73 Q58 75 70 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M91 73 Q91 90 102 90 Q113 90 113 73 Z\" fill=\"#49363B\" stroke=\"#49363B\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><ellipse cx=\"106\" cy=\"78\" rx=\"3\" ry=\"3\" fill=\"#FFFDF7\"/><path d=\"M90 73 Q102 75 114 73\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><path d=\"M73 108 Q80 110 87 104\" fill=\"none\" stroke=\"#49363B\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "awe": {
  "name": "감탄",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 46 Q58 38 68 46 M92 46 Q102 38 112 46\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"63\" cy=\"82\" rx=\"2.5\" ry=\"2.5\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"107\" cy=\"82\" rx=\"2.5\" ry=\"2.5\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><ellipse cx=\"80\" cy=\"107\" rx=\"4.5\" ry=\"6.5\" fill=\"#AD6678\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 },
 "curious": {
  "name": "궁금",
  "brows": "<g transform=\"translate(24 13) scale(.7 .8)\"><path d=\"M48 48 Q58 40 68 48 M92 55 L112 53\" fill=\"none\" stroke=\"#493C43\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
  "eyes": "<ellipse cx=\"58\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"58\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"62\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"53\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/><ellipse cx=\"102\" cy=\"76\" rx=\"12\" ry=\"12\" fill=\"#49363B\"/><ellipse cx=\"102\" cy=\"82\" rx=\"7\" ry=\"4\" fill=\"#77545C\"/><ellipse cx=\"106\" cy=\"71\" rx=\"4\" ry=\"4\" fill=\"#FFFDF7\"/><ellipse cx=\"97\" cy=\"81\" rx=\"2.2\" ry=\"2.2\" fill=\"#FFFDF7\"/>",
  "mouth": "<g transform=\"translate(0 -8)\"><ellipse cx=\"80\" cy=\"107\" rx=\"4.5\" ry=\"6.5\" fill=\"#AD6678\"/></g>",
  "fx": "<ellipse cx=\"41\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/><ellipse cx=\"119\" cy=\"87\" rx=\"11\" ry=\"6\" fill=\"#ff9db4\" opacity=\"0.6\"/>"
 }
};
  // 받은 캔버스의 기준 — 두 눈 가운데(80,76) · 입 가운데(80,99 · 그룹의 translate(0 -8) 를 지난 뒤)
  const EYE_C = [80, 76], MOUTH_C = [80, 99];
  const f = n => +n.toFixed(3);
  // at = { ex, ey: 두 눈 가운데 · mx, my: 입 가운데 · s: 배율 · sm: 입 배율(없으면 s) · eyePart: 눈 그룹 속성 · noBrows: 눈썹 빼기 · eyeColor: 눈동자 색 }
  // ⚠️ 눈 조각(eyePart)은 transform 이 «없는» 겉 그룹에 붙인다 — 깜박임의 CSS 가 속성 변환을 덮어쓰지 않게
  // ⚠️ 눈썹·눈·효과(볼·눈물)는 «눈»을 기준으로, 입은 «입»을 기준으로 따로 앉힌다 —
  //    얼굴마다 눈과 입 사이가 달라서 한 변환으로는 둘 다 못 맞춘다
  // at.sey — 눈만 세로로 더 늘리는 몫(1 이면 받은 그대로) · 동그란 눈이 타원이 된다 (아바타가 「어리둥절」에 맞춘다)
  // at.cheek = { l: [x, y], r: [x, y], kx, ky } — 볼터치(받은 cx 41/119 · cy 87)와 그 위의 빗금을
  //   «볼 가운데»를 축으로 그 자리에 옮기고 kx·ky 배로 늘린다. 없으면 눈 변환을 그대로 탄다 (NPC)
  // ⚠️ 볼과 빗금은 «한 변환»을 탄다 — 따로 옮기면 크기를 바꿀 때 빗금이 볼 밖으로 나간다
  function cheekSplit(fx) {
    const L = [], R = [], rest = [];
    fx.replace(new RegExp('<(?:ellipse|path) [^>]*/>', 'g'), el => {
      const cx = +((el.match(/ cx="([0-9.]+)"/) || [])[1]);
      // ⚠️ 옅은 볼(무표정·차가움·노려봄 · rx8 ry4)도 «같은 크기»로 편다 — 볼터치는 어느 표정이든 한 크기다
      if (/^<ellipse/.test(el) && / cy="87"/.test(el) && (cx === 41 || cx === 119)) (cx < 80 ? L : R).push(el.replace(/ rx="[0-9.]+" ry="[0-9.]+"/, ' rx="11" ry="6"'));
      else if (/stroke="#DC91A7"/.test(el)) {
        const d = el.match(/ d="([^"]+)"/)[1], subs = d.match(/M[^M]+/g) || [];
        const side = w => subs.filter(p => (parseFloat(p.slice(1)) < 80) === w).join(' ').trim();
        if (side(true)) L.push(el.replace(d, side(true)));
        if (side(false)) R.push(el.replace(d, side(false)));
      } else rest.push(el);
      return '';
    });
    return { L: L.join(''), R: R.join(''), rest: rest.join('') };
  }
  function draw(id, at) {
    const e = LIST[id] || LIST.def;
    const s = at.s, sm = at.sm || s;
    const te = `translate(${f(at.ex)},${f(at.ey)}) scale(${f(s)}) translate(${-EYE_C[0]},${-EYE_C[1]})`;
    const tm = `translate(${f(at.mx)},${f(at.my)}) scale(${f(sm)}) translate(${-MOUTH_C[0]},${-MOUTH_C[1]})`;
    const tey = at.sey ? `translate(${f(at.ex)},${f(at.ey)}) scale(${f(s)},${f(s * at.sey)}) translate(${-EYE_C[0]},${-EYE_C[1]})` : te;
    let fx = e.fx ? `<g transform="${te}">${e.fx}</g>` : '';
    if (e.fx && at.cheek) {
      const c = at.cheek, sp = cheekSplit(e.fx);
      const one = (p, cx, body) => body ? `<g transform="translate(${f(p[0])},${f(p[1])}) scale(${f(c.kx)},${f(c.ky)}) translate(${-cx},-87)">${body}</g>` : '';
      // at.noCheek — 볼터치·빗금을 통째로 뺀다 (남자 NPC 의 기본 표정 · portrait.js)
      fx = (at.noCheek ? '' : one(c.l, 41, sp.L) + one(c.r, 119, sp.R)) + (sp.rest ? `<g transform="${te}">${sp.rest}</g>` : '');
    }
    return `<g data-part="exp" data-exp="${LIST[id] ? id : 'def'}">`
      + fx
      + (e.brows && !at.noBrows ? `<g transform="${te}">${e.brows}</g>` : '')
      + `<g ${at.eyePart || ''}><g transform="${tey}">${at.eyeColor ? e.eyes.split('#49363B').join(at.eyeColor) : e.eyes}</g></g>`
      + (e.mouth ? `<g transform="${tm}"><g transform="translate(0 -8)">${e.mouth}</g></g>` : '')
      + '</g>';
  }
  window.ExpArt = { draw, has: id => !!LIST[id], hasBrows: id => !!(LIST[id] && LIST[id].brows), ids: Object.keys(LIST), nameOf: id => LIST[id] && LIST[id].name };
})();
