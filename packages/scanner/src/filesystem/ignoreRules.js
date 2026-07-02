export const IGNORED_DIRECTORIES = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.next',
    'target',
    '.idea',
    '.vscode',
]);
export function shouldIgnoreDirectory(name) {
    return IGNORED_DIRECTORIES.has(name);
}
//# sourceMappingURL=ignoreRules.js.map