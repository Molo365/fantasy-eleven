---
name: Artifact build environment
description: Environment requirements for running the monorepo build outside managed artifact workflows.
---

When running the workspace-wide build manually, provide the artifact build environment expected by the Vite config, including `PORT` and the artifact's `BASE_PATH`.

**Why:** Managed workflows inject these values, but the root recursive build does not; Vite config loading fails before compilation when either value is absent.

**How to apply:** For manual validation, use the preview artifact's configured port and base path, or run the artifact's own managed workflow instead of invoking the recursive build with no environment.