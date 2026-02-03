# Petrify 플러그인 설치 가이드

Petrify는 필기 노트 파일(.note)을 Obsidian Excalidraw 형식으로 변환하는 플러그인입니다.

## 요구사항

- Obsidian 1.11.0 이상
- Desktop 버전 (모바일 미지원 - 파일 시스템 접근 필요)
- [Excalidraw 플러그인](https://github.com/zsviczian/obsidian-excalidraw-plugin) 설치 권장

## 설치 방법

- [사용자용 설치](#사용자용-설치) - 빌드된 플러그인을 바로 사용
- [개발자용 설치](#개발자용-설치) - 소스 코드 수정 및 테스트

## 사용자용 설치

### 방법 1: 수동 설치

1. [Releases 페이지](https://github.com/your-repo/petrify/releases)에서 최신 버전 다운로드
   - `main.js`
   - `manifest.json`

2. Obsidian vault의 플러그인 폴더에 복사
   ```
   <your-vault>/.obsidian/plugins/petrify/
   ├── main.js
   └── manifest.json
   ```

3. Obsidian 재시작 또는 플러그인 새로고침

4. 설정 → 커뮤니티 플러그인 → "Petrify" 활성화

### 방법 2: BRAT 플러그인 사용 (베타 테스터용)

1. [BRAT](https://github.com/TfTHacker/obsidian42-brat) 플러그인 설치
2. BRAT 설정 → "Add Beta plugin" 클릭
3. 저장소 URL 입력: `your-username/petrify`
4. "Add Plugin" 클릭

## 개발자용 설치

### 사전 요구사항

- Node.js 20+
- pnpm

### 빌드 및 설치

1. 저장소 클론 및 의존성 설치
   ```bash
   git clone https://github.com/your-username/petrify.git
   cd petrify
   pnpm install
   ```

2. 전체 프로젝트 빌드
   ```bash
   pnpm build
   ```

3. 플러그인 파일을 Obsidian vault에 심볼릭 링크
   ```bash
   ln -s $(pwd)/packages/obsidian-plugin <your-vault>/.obsidian/plugins/petrify
   ```

4. Obsidian 재시작 후 플러그인 활성화

### 개발 모드 (핫 리로드)

```bash
cd packages/obsidian-plugin
pnpm dev
```

파일 변경 시 자동으로 `main.js`가 재빌드됩니다.
Obsidian에서 `Ctrl+R` (또는 `Cmd+R`)로 플러그인 새로고침.

## 플러그인 설정

설정 → 커뮤니티 플러그인 → Petrify → 설정 아이콘

### 폴더 매핑

| 설정 | 설명 |
|------|------|
| Watch Directory | 감시할 .note 파일 폴더 (절대 경로) |
| Output Directory | 변환된 파일 저장 위치 (vault 내 상대 경로) |

### OCR 설정

| 설정 | 설명 |
|------|------|
| Provider | Gutenye (로컬 OCR, API 키 불필요) |
| Confidence Threshold | OCR 신뢰도 임계값 (0-100) |

## 문제 해결

### 플러그인이 목록에 안 보임
- `manifest.json`과 `main.js`가 같은 폴더에 있는지 확인
- 폴더 경로: `<vault>/.obsidian/plugins/petrify/`

### 파일 변환이 안 됨
- Watch Directory 경로가 올바른지 확인
- 콘솔 로그 확인: `Ctrl+Shift+I` → Console 탭
