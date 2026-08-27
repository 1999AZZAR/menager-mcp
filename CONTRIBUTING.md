# Contributing to Menager MCP Server

Thank you for your interest in contributing to the Menager MCP Server! This document provides guidelines for contributing to this project.

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Security Considerations](#security-considerations)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Ways to Contribute

### Code Contributions
- **Bug fixes**: Fix issues in PTY management, buffer handling, or event hooks.
- **New features**: Add new multiplexing capabilities, session features, or process controls.
- **Performance improvements**: Optimize terminal buffering, regex evaluation, or backpressure.
- **Documentation**: Improve documentation and examples.

### Testing & Quality
- **Bug reports**: Report issues with detailed reproduction steps.
- **Test coverage**: Add or improve E2E test cases for the harness.
- **Security testing**: Test process tree isolation and resource limits.

### Documentation
- **README updates**: Keep documentation current.
- **Examples**: Provide usage examples and AI agent prompts.
- **Security guidelines**: Document terminal sandboxing best practices.

## Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/1999AZZAR/menager.git
   cd menager
   ```

2. **Install dependencies**:
   *(Requires build-essential/g++ for node-pty native bindings)*
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Start development server**:
   ```bash
   npm start
   ```

## Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and ensure tests pass.

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Commit your changes**:
   ```bash
   git commit -m "feat: brief description of your changes"
   ```

5. **Push to your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**

## Coding Standards

### General Guidelines
- Follow TypeScript best practices.
- Implement proper input validation and sanitization.
- Add comprehensive error handling, returning unified JSON errors.
- Respect memory limits (e.g., `maxBufferLines`) to prevent OOM.
- Ensure strict asynchrony for PTY blocking calls.

### Code Style
- Use 2 spaces for indentation.
- Use single quotes for strings.
- Follow the existing CommonJS/ESM interop patterns (e.g., node16 modules).

### Commit Messages
- Use conventional commit format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Keep first line under 50 characters.

## Testing

### Running Tests
You can run the existing manual E2E test harness scripts against the build.
(A Vitest suite is planned).

### Writing Tests
- Add E2E scenarios for new tools.
- Test concurrency and process tree limits.
- Test with different terminal configurations.

## Security Considerations

### Process Security
- **Never execute untrusted input blindly** without sanitization.
- **Use allowlists** for permitted shell commands where possible.
- **Implement proper timeouts** (e.g., `ttlMs`).
- **Ensure tree-kill** recursively terminates all child processes.

### Memory & Buffering
- **Prevent memory leaks** by clearing intervals/timeouts on exit.
- **Enforce strict buffer limits** on `rawLines` and `cleanLines`.
- **Implement backpressure** during large chunk writes to PTY.

## Pull Request Process

1. **Ensure all builds pass**
2. **Update documentation** if needed
3. **Add tests** for new features
4. **Follow coding standards**
5. **Write clear commit messages**

### PR Checklist
- [ ] Builds correctly (`npm run build`)
- [ ] Documentation updated
- [ ] Security review completed
- [ ] No sensitive data logged in observability
- [ ] Memory limits respected
- [ ] Commit messages follow conventions
- [ ] PR description is clear

## Reporting Issues

### Bug Reports
Please include:
- **Steps to reproduce**: Detailed steps.
- **Expected behavior**: What should happen.
- **Actual behavior**: What actually happens.
- **Environment**: OS, Node.js version, platform.
- **Logs**: Any relevant error messages from stderr.

### Feature Requests
Please include:
- **Use case**: Why this feature is needed.
- **Proposed solution**: How it should work.

### Security Issues
- **Do not report security issues publicly.**
- **Contact maintainers directly** for security concerns.

## Getting Help

- **Issues**: Use GitHub issues for bugs and features.
- **Documentation**: Check the README and codebase.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
