# Plugin 레벨 로깅 추가 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 파일 변환 과정의 각 단계를 console.log + Obsidian Notice로 로깅하여 디버깅과 사용자 피드백을 제공한다.

**Architecture:** obsidian-plugin의 `main.ts` `onFileChange` 핸들러에서만 로깅한다. core 패키지는 변경하지 않는다. `handleFileChange`가 null을 반환하는 경우(스킵)와 string을 반환하는 경우(성공)를 구분하여 로깅한다.

**Tech Stack:** Obsidian API (`Notice`), `console.log`

---

### Task 1: onFileChange 핸들러에 로깅 추가

**Files:**
- Modify: `packages/obsidian-plugin/src/main.ts:90-97`

**Step 1: 로깅 코드 구현**

`startWatchers()`의 `onFileChange` 콜백을 아래와 같이 수정한다:

```typescript
watcher.onFileChange(async (event) => {
  console.log(`[Petrify] 파일 감지: ${event.name} (${event.extension})`);

  try {
    const notice = new Notice(`[Petrify] 변환 중: ${event.name}`, 0);
    const result = await this.pipeline.handleFileChange(event);

    if (result) {
      const frontmatter = createFrontmatter({ source: event.id, mtime: event.mtime });
      const outputPath = this.getOutputPath(event.name, mapping.outputDir);
      await this.saveToVault(outputPath, frontmatter + result);
      notice.setMessage(`[Petrify] 변환 완료: ${event.name}`);
      console.log(`[Petrify] 변환 완료: ${event.name} → ${outputPath}`);
    } else {
      console.log(`[Petrify] 스킵: ${event.name} (미지원 확장자 또는 이미 최신)`);
      notice.hide();
    }

    setTimeout(() => notice.hide(), 3000);
  } catch (error) {
    console.error(`[Petrify] 변환 실패: ${event.name}`, error);
    new Notice(`[Petrify] 변환 실패: ${event.name}`);
  }
});
```

핵심 동작:
- `Notice(..., 0)`: timeout 0으로 생성해서 수동 제어
- 성공 시: 메시지를 "변환 완료"로 교체 후 3초 뒤 자동 숨김
- 스킵 시: Notice 즉시 숨김 (사용자에게 불필요한 알림 방지)
- 실패 시: 에러 Notice 표시 (기본 timeout)

**Step 2: 기존 onError 핸들러의 console.error에 파일 정보 유지 확인**

기존 `watcher.onError` 핸들러(line 99-102)는 그대로 유지한다. 이미 Notice + console.error 패턴을 사용 중이다.

**Step 3: 빌드 및 수동 검증**

```bash
cd packages/obsidian-plugin && pnpm run build
```

Obsidian에서 플러그인 리로드 후:
1. DevTools 콘솔에서 `[Petrify]` 접두사 로그 확인
2. 파일 변경 시 Notice 토스트 표시 확인
3. 이미 변환된 파일은 Notice 없이 콘솔에 스킵 로그만 출력되는지 확인

**Step 4: 커밋**

```bash
git add packages/obsidian-plugin/src/main.ts
git commit -m "feat: 파일 변환 과정에 console.log + Notice 로깅 추가"
```
