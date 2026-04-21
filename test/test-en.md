---
title: Rich Markdown Demo
description: A compact English demo page for previewing front matter chips, headings, lists, tables, code blocks, and responsive reading layout
status: demo
tags: markdown, frontmatter, preview, mobile
---

# Rich Markdown Demo

> This page is a synthetic fixture used to preview Markdown rendering without exposing any personal files.

---

## Overview

This document is designed to simulate a realistic knowledge-base or project note page. It includes common content blocks you would expect in product docs, engineering notes, or research writeups.

### Highlights

- Compact front matter chips
- Clear heading hierarchy
- Inline code such as `npm test` and `pm2 restart workspace-browser`
- Tables with multiple columns
- Syntax-highlighted code blocks
- A short task list for visual QA

### Sample paragraph

Workspace Browser renders Markdown as a readable document view while preserving raw source access. The goal of this page is to provide a safe, shareable fixture for screenshots, UI review, and regression testing.

## Example Table

| Area | Purpose | Notes |
| --- | --- | --- |
| Front Matter | Metadata preview | Displayed as compact chips |
| Markdown Body | Reading experience | Optimized for long-form content |
| Raw View | Source inspection | Toggle available at the top |

## Example Code

```js
async function loadPreview(name) {
  const response = await fetch(`/fixtures/${name}.md`);
  if (!response.ok) throw new Error(`Failed: ${response.status}`);
  return response.text();
}
```

## Task List

- [x] Show metadata chips
- [x] Keep the page safe for public screenshots
- [x] Use English content for international preview
- [ ] Add final README screenshot after approval
