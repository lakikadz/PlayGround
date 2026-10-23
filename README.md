# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/lakikadz/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/lakikadz/PlayGround)

- 🎮 [Open the project](https://omgithub.com/lakikadz/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=lakikadz%2FPlayGround).
- 💻 [Explore the source](https://github.com/lakikadz/PlayGround).
- 🛠️ [Check build runs](https://github.com/lakikadz/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/lakikadz/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/lakikadz).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->

## 🖼️ تحريك الصورة — لغز الواحة

لعبة ألغاز صور منزلقة بواجهة عربية (RTL) صُممت لسطح المكتب وتعمل بالكامل في المتصفح دون بناء أو اتصال بالشبكة.

- ثلاث درجات صعوبة: 3×3، 4×4، 5×5.
- خلط قابل للحل دائمًا، وحركة قطع متحركة بسلاسة عبر CSS Transforms.
- مؤقّت، عدّاد حركات، شريط تقدّم، وأفضل نتيجة محفوظة لكل مستوى في `localStorage`.
- معاينة الصورة، مؤثرات صوتية خفيفة، شاشة فوز بالاحتفال، ودليل لعب.
- لوحة مفاتيح كاملة: الأسهم أو `WASD` لتحريك الفراغ، `P` للمعاينة، `N` للعبة جديدة، و`1` `2` `3` للصعوبة.

### التشغيل محليًا

```sh
python3 -m http.server 3002
```

ثم افتح `http://localhost:3002`.

### الاختبارات

```sh
node --test tests/game.test.mjs
```

### الأصول

- رسم المشهد: `assets/puzzle.svg`.
- الخطوط: Cairo وAmiri مرخّصة بموجب SIL Open Font License، وتوجد نسخ التراخيص في `assets/fonts/`.
