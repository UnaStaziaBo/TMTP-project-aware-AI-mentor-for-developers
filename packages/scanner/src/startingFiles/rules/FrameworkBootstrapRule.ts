import type { StartingFileRule } from '../registry.js';

const BOOTSTRAP_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /FastAPI\s*\(/, reason: 'FastAPI application bootstrap detected' },
  { pattern: /Flask\s*\(\s*__name__/, reason: 'Flask application bootstrap detected' },
  {
    pattern: /django\.core\.management|get_wsgi_application|execute_from_command_line/,
    reason: 'Django application bootstrap detected',
  },
  { pattern: /@SpringBootApplication/, reason: 'Spring Boot application bootstrap detected' },
  { pattern: /NestFactory\.create\s*\(/, reason: 'NestJS application bootstrap detected' },
  { pattern: /\bexpress\s*\(\s*\)/, reason: 'Express application bootstrap detected' },
  { pattern: /ReactDOM\.(createRoot|render)\s*\(/, reason: 'React application bootstrap detected' },
  { pattern: /createApp\s*\(/, reason: 'Vue application bootstrap detected' },
];

export const FrameworkBootstrapRule: StartingFileRule = {
  name: 'framework-bootstrap',
  evaluate(context) {
    const match = BOOTSTRAP_PATTERNS.find((entry) => entry.pattern.test(context.content));
    if (match) {
      return { points: 35, reason: match.reason };
    }
    return null;
  },
};
