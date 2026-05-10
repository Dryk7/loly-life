import sys
sys.stdout.reconfigure(encoding='utf-8')
text = open('D:/life-sim/game.js', encoding='utf-8').read()

depth = 0
line = 1
i = 0
N = len(text)
state_stack = ['code']
events = []  # (line, depth_after)

while i < N:
    c = text[i]
    nc = text[i+1] if i+1 < N else ''
    s = state_stack[-1]

    if s == 'line_cmt':
        if c == '\n':
            state_stack.pop()
            line += 1
        i += 1
        continue
    if s == 'block_cmt':
        if c == '\n':
            line += 1
        if c == '*' and nc == '/':
            state_stack.pop()
            i += 2
            continue
        i += 1
        continue
    if s == 'sq_str':
        if c == '\\':
            i += 2
            continue
        if c == "'":
            state_stack.pop()
        if c == '\n':
            line += 1
        i += 1
        continue
    if s == 'dq_str':
        if c == '\\':
            i += 2
            continue
        if c == '"':
            state_stack.pop()
        if c == '\n':
            line += 1
        i += 1
        continue
    if s == 'tpl':
        if c == '\\':
            i += 2
            continue
        if c == '$' and nc == '{':
            state_stack.append('code')
            i += 2
            continue
        if c == '`':
            state_stack.pop()
        if c == '\n':
            line += 1
        i += 1
        continue
    if c == '/' and nc == '/':
        state_stack.append('line_cmt')
        i += 2
        continue
    if c == '/' and nc == '*':
        state_stack.append('block_cmt')
        i += 2
        continue
    if c == "'":
        state_stack.append('sq_str')
        i += 1
        continue
    if c == '"':
        state_stack.append('dq_str')
        i += 1
        continue
    if c == '`':
        state_stack.append('tpl')
        i += 1
        continue
    if c == '\n':
        line += 1
        i += 1
        continue
    if c == '{':
        depth += 1
    elif c == '}':
        if len(state_stack) >= 2 and state_stack[-2] == 'tpl':
            state_stack.pop()
            i += 1
            continue
        depth -= 1
    i += 1

# Track depth at end of each line
i = 0
line = 1
depth = 0
state_stack = ['code']
line_depths = {}

while i < N:
    c = text[i]
    nc = text[i+1] if i+1 < N else ''
    s = state_stack[-1]

    if s == 'line_cmt':
        if c == '\n':
            state_stack.pop()
            line_depths[line] = depth
            line += 1
        i += 1
        continue
    if s == 'block_cmt':
        if c == '\n':
            line_depths[line] = depth
            line += 1
        if c == '*' and nc == '/':
            state_stack.pop()
            i += 2
            continue
        i += 1
        continue
    if s == 'sq_str':
        if c == '\\':
            i += 2
            continue
        if c == "'":
            state_stack.pop()
        if c == '\n':
            line_depths[line] = depth
            line += 1
        i += 1
        continue
    if s == 'dq_str':
        if c == '\\':
            i += 2
            continue
        if c == '"':
            state_stack.pop()
        if c == '\n':
            line_depths[line] = depth
            line += 1
        i += 1
        continue
    if s == 'tpl':
        if c == '\\':
            i += 2
            continue
        if c == '$' and nc == '{':
            state_stack.append('code')
            i += 2
            continue
        if c == '`':
            state_stack.pop()
        if c == '\n':
            line_depths[line] = depth
            line += 1
        i += 1
        continue
    if c == '/' and nc == '/':
        state_stack.append('line_cmt')
        i += 2
        continue
    if c == '/' and nc == '*':
        state_stack.append('block_cmt')
        i += 2
        continue
    if c == "'":
        state_stack.append('sq_str')
        i += 1
        continue
    if c == '"':
        state_stack.append('dq_str')
        i += 1
        continue
    if c == '`':
        state_stack.append('tpl')
        i += 1
        continue
    if c == '\n':
        line_depths[line] = depth
        line += 1
        i += 1
        continue
    if c == '{':
        depth += 1
    elif c == '}':
        if len(state_stack) >= 2 and state_stack[-2] == 'tpl':
            state_stack.pop()
            i += 1
            continue
        depth -= 1
        if depth < 0:
            print(f'Negative at line {line}')
            sys.exit(0)
    i += 1

# Find segments where depth drops to 0 (function boundaries)
zeros = []
for ln in sorted(line_depths.keys()):
    if line_depths[ln] == 0:
        zeros.append(ln)

print(f'Lines where depth returned to 0: {len(zeros)} total')
print(f'First/last 5 zero-depth lines: {zeros[:5]} ... {zeros[-5:]}')
