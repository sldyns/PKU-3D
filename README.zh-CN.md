<div align="center">

# PKU-3D

**北京大学三维校园**

由 **GPT-6 Astra** 构建，全部基础数据与建模参考均来自公开来源。

**[在线演示](https://sldyns.github.io/PKU-3D/)** · [English](README.md) · [版本发布](https://github.com/sldyns/PKU-3D/releases) · [贡献指南](CONTRIBUTING.zh-CN.md)

[![Version](https://img.shields.io/badge/version-1.5.5-8b302c)](https://github.com/sldyns/PKU-3D/releases/tag/v1.5.5)
[![WebGL 2](https://img.shields.io/badge/rendering-WebGL%202-2f6555)](https://sldyns.github.io/PKU-3D/)

</div>

本项目为非官方校园可视化作品。

https://github.com/user-attachments/assets/67393710-bc94-461c-9472-c6d6b0e4581e

[![未名湖与博雅塔周边的校园全景](docs/media/campus.jpg)](https://sldyns.github.io/PKU-3D/)

PKU-3D 是北京大学燕园校区的交互式三维模型，包含楼宇、院落、道路与水系。项目在浏览器中运行，支持建筑搜索、地图对照、光照和天气调节，以及沿校园道路行走的行人。

<table>
<tr>
<td width="50%"><img src="docs/media/west-gate.jpg" alt="北大西门"><br><b>西校门</b></td>
<td width="50%"><img src="docs/media/courtyards.jpg" alt="全斋及周边院落"><br><b>校园院落</b></td>
</tr>
<tr>
<td colspan="2"><img src="docs/media/evening.jpg" alt="傍晚的未名湖"><br><b>未名湖夜景</b></td>
</tr>
</table>

## 功能

- 搜索、点选建筑，切换正面、侧面和屋顶视角。
- 三维与平面视图使用统一坐标；卫星图与标准地图可跳转官网查看。
- 调整时刻、季节和天气，观察植被、水面反射与行人。
- 第一人称步行漫游，支持键盘、触屏和沿校园道路自动行走。
- 默认使用高画质，可在光影面板中手动选择中、低画质。

现有测试中，镜头交互仍未达到稳定 60 FPS。测量结果与验证范围见[性能说明](docs/development/performance.md)。

1.5.4 将选中的场景下载量从 100.3 MB 减至 86.3 MB，并通过三个请求流式读取原有 99 个块。可逆整数编码保留全部解码模型字节；High 仍为默认，原始图片、阴影、反射和抗锯齿保持不变。原格式及离线资源继续保留。启动实测的适用范围与沿用的 1.5.3 响应优化见[性能说明](docs/development/performance.md)。

1.5.5 在「光影与生活」中新增**「CPU 优化（实验）」**，仅在高画质下生效，**默认关闭**。开启后批量执行原有可见性计算与实例收集，使用空闲时间准备的固定 16 MiB CPU 内存。模型细节、原始图片、阴影、反射和抗锯齿保持不变。已有对照显示 CPU 开销降低，但部分操作的帧间隔回退，因此保留选择权；验证结果及范围见[性能说明](docs/development/performance.md)。

## 操作

| 操作方式 | 效果 |
| --- | --- |
| 按住鼠标左键拖动 | 三维视图中旋转；平面布局中平移 |
| 按住鼠标右键拖动，或 `Shift` + 左键拖动 | 平移视角 |
| 滚动鼠标滚轮 | 向上放大，向下缩小 |
| 左键单击建筑或地点名称 | 查看建筑详情 |
| 方向键 `↑` `↓` `←` `→` | 平移视角 |
| `+` / `−` | 放大 / 缩小 |
| `/` | 打开地点搜索 |
| `Esc` | 关闭弹窗或建筑详情 |

触屏使用单指拖动、双指捏合缩放。点击四角框图标返回全校视角；网页右下角的「操作指南」可随时打开查看。

点击右下角「步行」或地点详情中的「在附近步行」进入第一人称。`WASD` 或方向键移动，按住 `Shift` 加快，拖动画面环顾；手机使用方向按钮。按 `Esc` 或「退出」恢复之前的视角。「沿路探索」支持规划路线、自动步行、暂停继续和调整进度。步行范围沿用地图道路，用于场景漫游，不作实际导航。

建议使用支持 WebGL 2 的电脑浏览器。

## 数据来源

**全部基础数据与建模参考均来自公开来源**，包括 OpenStreetMap、Esri World Imagery，以及公开的学校、院系和建筑资料。具体署名见[数据来源](docs/SOURCES.zh-CN.md)。

模型仍在校对，部分尺寸与建筑细节为近似。

## 本地运行

```sh
git clone https://github.com/sldyns/PKU-3D.git
cd PKU-3D
npm install
npm run setup
npm run build
npm run dev
```

环境要求、场景构建与目录说明见[开发文档](docs/DEVELOPMENT.zh-CN.md)。

## 贡献

欢迎提交建筑纠错、模型改进和交互修复。反馈空间问题时，请附上建筑名称、圈注的场景截图，以及可用的公开来源链接。具体说明见[贡献指南](CONTRIBUTING.zh-CN.md)。

## 许可

软件与原创文档采用 [MIT](LICENSE)；OSM 衍生地理数据库采用 [ODbL 1.0](DATA_LICENSE.md)。第三方内容的权利归各自权利人所有，详见[许可说明](docs/LICENSING.md)。

## 当前模型状态

局部修补不等于全校真实性或全局性能验收。已交付范围和具名资料缺口见[模型现状](docs/development/model-status.md)，未通过指标见[性能说明](docs/development/performance.md)。
