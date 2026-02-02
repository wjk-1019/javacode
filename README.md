多模态内容检索平台 (MCRS-Web)


1. 项目概述
本工程为多模态内容检索平台的 Web 前端子系统。系统旨在提供基于语义理解的高效多媒体内容检索服务，支持跨模态（Text-to-Image, Image-to-Image）搜索及视频片段溯源。项目采用 React 18 全家桶进行开发，通过 RESTful API 与后端推理服务交互。

2. 技术架构

2.1 核心技术栈
*   **Framework**: React 18.2+
*   **Language**: TypeScript 5.0+
*   **Build Tool**: Vite 4.x
*   **UI/Styling**: Tailwind CSS 3.x
*   **HTTP Client**: Native Fetch API

### 2.2 目录规范
```text
src/
├── main.tsx          # 应用入口 (Entry Point)
├── yemian.tsx        # 核心业务组件 (Main Business Logic)
├── index.css         # 全局样式与 Tailwind 指令
└── ...
```

3. 核心业务功能

3.1 多模态检索 (Multimodal Search)
*   **文本检索 (T2I)**: 支持自然语言查询，对接后端 CLIP 模型语义向量检索。
*   **以图搜图 (I2I)**: 支持本地图片上传，提取特征向量进行相似度匹配。
*   **状态隔离**: 独立维护不同模态的检索上下文与结果集，支持无缝切换。

3.2 结果呈现与交互
*   **智能排序**: 基于余弦相似度 (Cosine Similarity) 降序排列，默认展示 Top-3 匹配项。
*   **多源兼容**: 适配 `image_url` / `reference_image_url` 等多种后端数据结构。
*   **视频溯源**: 集成视频流媒体播放器，支持基于 `start_time` / `end_time` 的时间戳自动定位与片段循环。

4. 接口规范 (API Integration)

后端服务基准地址: `API_BASE_URL` (默认: `http://localhost:8000`)

| 模块 | 接口路径 | Method | Content-Type | 关键参数 |
| :--- | :--- | :--- | :--- | :--- |
| 文本检索 | `/search_by_text` | POST | `multipart/form-data` | `query`: string, `limit`: number |
| 图片检索 | `/search_by_image` | POST | `multipart/form-data` | `file`: Binary, `limit`: number |



5. 开发环境搭建

### 5.1 前置要求
*   Node.js >= 16.0.0
*   npm >= 8.0.0


---
© 2025 Internal Development Team. All Rights Reserved.
