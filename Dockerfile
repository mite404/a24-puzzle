# Ralph Wiggum Loop — a24-puzzle crossword eval
# Runs Claude Code CLI in an isolated container as a non-root user.
#
# Deviations from the stock template, all required by this project:
#   - bun            : AGENTS.md mandates bun; validation is `bun test`
#   - poppler-utils  : mining docs/film-scripts/*.pdf for crossword entries
#   - ripgrep        : Claude Code's search path
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      ca-certificates \
      poppler-utils \
      ripgrep \
      curl \
      unzip \
  && rm -rf /var/lib/apt/lists/*

# Claude Code CLI + bun, both global so the non-root user inherits them.
RUN npm install -g @anthropic-ai/claude-code bun

# Claude refuses --dangerously-skip-permissions when running as root.
RUN useradd -m -s /bin/bash ralph \
  && mkdir -p /workspace \
  && chown ralph:ralph /workspace

USER ralph
WORKDIR /workspace

# Identity for Ralph's commits. The mounted repo has NO remote, so these
# commits stay local until you fetch them.
RUN git config --global user.email "ralph@autonomous.ai" \
  && git config --global user.name "Ralph Wiggum" \
  && git config --global --add safe.directory /workspace

CMD ["bash"]
