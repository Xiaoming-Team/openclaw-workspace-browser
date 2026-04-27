# Auto URL Cases

这个链接贴在中文里也要识别example.com/path后面还是中文。
另一个裸链接是 docs.foo-bar.dev/net/test?x=1#hash，结尾的中文不能被吃进去。
标点后面也要对：https://workspace-browser.dev/hello-world。

下面这些不应该被识别成网址：
- src/renderers/markdown.js 是源码路径，不是网址
- app.bundle.ts 只是 TypeScript 文件名
- styles/main.css 是样式文件路径
- utils/helper.jsx 和 component.tsx 也是代码文件
