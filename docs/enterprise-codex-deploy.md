# OpenBidKit Enterprise Codex 自动部署方案

## 目标

基于 OpenBidKit 易标源码建立企业二开仓库，保留 AGPL-3.0、NOTICE 和原作者署名，使用 Codex 持续完成功能开发、构建验证、打包发版和后续私有化部署。

## 仓库策略

- `origin`：`https://github.com/wgcccn/OpenBidKit_Enterprise.git`
- `upstream`：`https://github.com/FB208/OpenBidKit_Yibiao.git`
- 默认分支：`main`
- 许可证：继续遵守 `AGPL-3.0`
- 保留 `LICENSE`、`NOTICE`、README 中的原项目出处

## 本地开发验证

进入 `client` 目录：

```bash
npm ci
npm run build
npm run dist:win
```

当前 Codex 环境可以使用内置 Node/pnpm 进行验证，正式开发机建议安装独立 Node.js LTS 与 Git。

## Codex 执行流

1. 同步 `origin/main`
2. 新建功能分支
3. 修改代码
4. 执行类型检查和前端构建
5. 输出变更说明
6. 提交并推送
7. 触发 GitHub Actions 打包

建议任务模板：

```text
目标：实现/修复 xxx 功能。
约束：
1. 保留 AGPL-3.0 和 NOTICE。
2. 不破坏技术标主流程。
3. 修改后必须执行类型检查和构建。
4. 工具安装优先放到 D:\Program Files\OpenBidKit-Codex\。
验收：
1. 功能入口可访问。
2. 页面无 TypeScript 错误。
3. 生产构建通过。
4. 输出变更说明。
```

## GitHub Actions 建议

```yaml
name: build-desktop

on:
  workflow_dispatch:
  push:
    tags:
      - "v*"

jobs:
  windows:
    runs-on: windows-latest
    defaults:
      run:
        working-directory: client
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: client/package-lock.json
      - run: npm ci
      - run: npm run build
      - run: npm run dist:win
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/upload-artifact@v4
        with:
          name: windows-release
          path: client/release/**
```

## 商务标迭代路线

### M1 本地可用版

- 商务响应矩阵保存
- 附件清单增删改
- Markdown/Word 导出
- 与现有模板系统打通

### M2 AI 辅助版

- 招标文件商务条款抽取
- 合同偏离识别
- 响应口径生成
- 付款、质保、保函、有效期自动核对

### M3 企业版

- 企业资信材料库
- 多角色复核流
- 项目材料包版本管理
- 私有模型和本地知识库
- 权限、审计和私有化部署

