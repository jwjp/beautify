# Beautify

**복잡한 데이터를 한눈에.** Beautify는 자주 쓰는 파일을 읽기 쉽게 정리하는 무료 오픈소스 도구입니다. 텍스트를 붙여 넣거나 로컬 파일을 연 뒤, 결과를 살펴보고 복사하거나 다운로드할 수 있습니다.

**바로 사용하기:** [jwjp.github.io/beautify](https://jwjp.github.io/beautify/)

기본 언어는 영어입니다. 화면 오른쪽 위에서 한국어로 바꿀 수 있습니다. [English README](README.md)

## 기능

- JSON, YAML, XML, HTML, CSS, JavaScript, SQL, Markdown 정리
- 접고 펼칠 수 있는 JSON 트리 뷰
- 들여쓰기 2칸/4칸, 긴 줄 바꿈, 구문 강조
- 파일 열기와 드래그 앤 드롭, 결과 복사 및 다운로드
- **Ctrl/⌘ + Enter** 단축키
- 입력 내용은 브라우저 안에서만 처리

## 로컬 실행

Node.js 20.19 이상 또는 22.12 이상이 필요합니다.

```bash
npm install
npm run dev
```

프로덕션 빌드는 `npm run build`, 테스트는 `npm test`로 실행합니다.

## 참고

SQL은 일반 SQL 문법을 기준으로 보기 좋게 정리하며, 데이터베이스에서 실행 가능한지 검사하지는 않습니다. XML에 일반 텍스트와 자식 요소가 섞여 있다면 공백이 바뀔 수 있으므로 결과를 확인하세요.

입력과 출력은 서버로 전송하거나 저장하지 않습니다. 선택한 화면 언어만 브라우저의 로컬 저장소에 보관합니다.

기여 방법은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요. 라이선스는 [MIT](LICENSE)입니다.
