# Obsidian Community Plugin Submission Preparation

## Overview

Petrify를 Obsidian 커뮤니티 플러그인으로 제출하기 위한 준비 사항 분석.

References:
- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin)
- [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Submission requirements](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins)
- [obsidian-releases repo](https://github.com/obsidianmd/obsidian-releases)

---

## Category A: Must Fix (Submission Blockers)

### A1. LICENSE file missing

- **Current**: Root에 LICENSE 파일 없음. README에 "MIT"만 언급
- **Required**: 리포지토리 루트에 `LICENSE` 파일 필수
- **Action**: MIT LICENSE 파일 생성

### A2. manifest.json must be at repository root

- **Current**: `packages/obsidian-plugin/manifest.json`에만 존재
- **Required**: 리뷰 봇이 리포지토리 루트의 manifest.json을 검증함
- **Action**: 루트에 manifest.json 복사 (빌드 시 자동 동기화 스크립트 권장)

### A3. Description must end with period

- **Current**: `"Convert handwriting notes to Excalidraw with OCR support"`
- **Required**: 마침표(.)로 끝나야 함
- **Action**: `"Convert handwriting notes to Excalidraw with OCR support."` 로 수정

### A4. console.log not allowed

- **Current**: `logger.ts`에서 `console.log` 사용
- **Required**: `console.warn`, `console.error`, `console.debug`만 허용
- **Action**: `console.log` → `console.debug`로 변경

### A5. Inline styles must move to CSS

- **Current**: `settings-tab.ts`(30+ occurrences)와 `folder-browse-modal.ts`(14 occurrences)에서 `.style.` 직접 할당
- **Required**: "스타일은 JS/HTML이 아닌 CSS로 관리" 가이드라인
- **Action**: `styles.css` 파일 생성, CSS 클래스로 마이그레이션, 릴리스 에셋에 styles.css 추가

---

## Category B: Should Fix (Improves Approval Chances)

### B1. Network usage disclosure

- **Current**: Google Drive/Vision API는 README에 언급되어 있으나, Tesseract 에셋 다운로드(최초 실행 시)에 대한 명시적 공개 없음
- **Required**: 가이드라인 - 네트워크 서비스 사용 시 어떤 서비스인지 README에 명시
- **Action**: "Network Usage" 또는 "Privacy" 섹션 추가:
  - Tesseract.js: 최초 실행 시 에셋 다운로드 (이후 로컬 캐싱)
  - Google Cloud Vision API: OCR provider로 선택 시 이미지 데이터 전송
  - Google Drive API: Google Drive 소스 사용 시 파일 목록/다운로드

### B2. Vault external file access disclosure

- **Current**: 로컬 파일 시스템 감시 기능이 vault 밖을 읽지만 명시적 공개 없음
- **Required**: vault 외부 파일 접근 이유를 README에 명시
- **Action**: Requirements 또는 별도 섹션에 "이 플러그인은 설정에 지정된 외부 디렉토리의 파일을 읽습니다" 명시

### B3. authorUrl field

- **Current**: manifest.json에 authorUrl 없음
- **Action**: `"authorUrl": "https://github.com/jo-minjun"` 추가

### B4. community-plugins.json PR entry

- **Action**: 제출 시 다음 항목 추가:
  ```json
  {
    "id": "petrify",
    "name": "Petrify",
    "author": "minjun.jo",
    "description": "Convert handwriting notes to Excalidraw with OCR support.",
    "repo": "jo-minjun/petrify"
  }
  ```

### B5. Release assets with styles.css

- **Current**: release.yml에 styles.css 미포함 (파일 자체가 아직 없음)
- **Action**: A5 완료 후 release.yml에 styles.css 에셋 추가

### B6. minAppVersion verification

- **Current**: 1.11.0으로 설정
- **Action**: 사용하는 모든 Obsidian API가 1.11.0에서 지원되는지 확인. 불확실하면 최신 안정 버전으로 상향

---

## Category C: Nice to Have (Quality Improvements)

### C1. package.json version sync

- **Current**: root package.json version 0.1.0, manifest 0.1.2
- **Action**: 혼란 방지를 위해 동기화 권장

### C2. Sensitive data in repository

- **Action**: `data.json`이 .gitignore에 포함되어 있는지 확인

### C3. UI text sentence case audit

- **Action**: settings-tab.ts의 모든 setName(), setDesc() 텍스트가 sentence case인지 검증 (Title Case 금지)

### C4. Screenshots/Demo

- **Current**: README에 스크린샷 없음
- **Action**: 설정 화면, 변환 결과 등 스크린샷 추가 시 리뷰어 이해도와 사용자 발견성 향상

### C5. Promise handling audit

- **Action**: 모든 Promise가 await, .catch(), .then(_, reject), 또는 void로 명시적 처리되는지 확인

---

## Submission Process

1. Category A 전부 해결
2. Category B 중 B1~B3, B5 해결
3. 새 버전으로 GitHub Release 생성 (태그, manifest, release 에셋 버전 일치)
4. [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases) 리포에 PR 생성
   - `community-plugins.json` 파일 끝에 B4 항목 추가
5. 자동 검증 봇 통과 대기
6. Obsidian 팀 코드 리뷰 → 피드백 대응 → 승인

---

## Checklist

- [ ] A1: LICENSE 파일 생성
- [ ] A2: 루트에 manifest.json
- [ ] A3: description 마침표 추가
- [ ] A4: console.log → console.debug
- [ ] A5: 인라인 스타일 → styles.css
- [ ] B1: 네트워크 사용 공개
- [ ] B2: vault 외부 파일 접근 공개
- [ ] B3: authorUrl 추가
- [ ] B5: release.yml에 styles.css 추가
- [ ] B6: minAppVersion 검증
- [ ] C1: version 동기화
- [ ] C2: data.json gitignore 확인
- [ ] C3: sentence case 검증
- [ ] C4: 스크린샷 추가
- [ ] C5: Promise 처리 검증
- [ ] 새 릴리스 생성
- [ ] community-plugins.json PR 제출
