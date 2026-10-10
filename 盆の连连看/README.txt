盆の连连看🧋 — 使用说明

这是纯 HTML/CSS/JavaScript 版本，不需要 Flask，也不需要 Python。

文件结构：
盆の连连看/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  └─ game.js
└─ images/
   ├─ dy01.jpg
   ├─ dy02.jpg
   └─ ... dy12.jpg

1. 把你的 dy01～dy12 图片复制到 images 文件夹。
2. 文件名保持 dy01、dy02……dy12。
3. 支持 jpg / png / jpeg / webp，程序会自动尝试扩展名。
4. 双击 index.html 即可本地打开。
5. 以后部署 GitHub Pages / Netlify / Cloudflare Pages 时，直接上传整个文件夹即可。

当前难度：
- 轻松：8×8
- 普通：10×10
- 困难：10×14

困难模式特意保持 10 列、增加到 14 行：
这样手机竖屏时图片不会因为列数太多而缩得很小，同时棋盘会更接近占满整屏。

如果你要增加素材：
在 js/game.js 里找到 IMAGE_KEYS，把 dy13、dy14 等继续加进去即可。
