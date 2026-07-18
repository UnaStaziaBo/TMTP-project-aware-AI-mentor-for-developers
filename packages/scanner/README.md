# @tmpt/scanner

The scanner package is the core analysis engine for TMTP.

It provides a deterministic pipeline that inspects a project directory and produces a structured analysis result for downstream learning features.

## What it does

The scanner currently performs:

- filesystem scanning
- language detection
- framework detection
- infrastructure detection
- dependency detection
- starting-file discovery (a deterministic, rule-based ranking of which files
  a developer should read first — see `StartingFileCandidate`)
- project graph edges (`projectGraph.edges`): the same import resolver that
  powers starting-file scoring also emits the verified local `from`/`to`
  import relationships it found, at zero extra cost. Never invented — a
  project with limited import support just gets a sparser graph.

Each stage enriches the same ProjectScanResult object.

## Architecture

```text
Project
↓
Filesystem Stage
↓
Language Stage
↓
Framework Stage
↓
Infrastructure Stage
↓
Dependency Stage
↓
Starting File Stage (also produces projectGraph.edges)
↓
ProjectScanResult
```

## Supported detection

### Languages
- Python
- TypeScript
- Java

### Frameworks
- FastAPI
- React
- NestJS
- Django
- Spring Boot

### Infrastructure
- Docker
- Docker Compose
- GitHub Actions
- Kubernetes
- Terraform
- Dev Containers
- Nginx

### Dependencies
- Pydantic
- SQLAlchemy
- React Router
- Axios
- JWT
- Django REST Framework
- Spring Security

## Usage

```ts
import { scanProject } from '@tmpt/scanner';

const result = await scanProject('./my-project');
console.log(result);
```

## Testing

```bash
pnpm --filter @tmpt/scanner test:integration
```
