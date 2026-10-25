with open('css/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update root text variables
content = content.replace('--text-dark: #183B53;', '--text-dark: #16324F;')
content = content.replace('--text-muted: #4B6F88;', '--text-muted: #2F4858;')
content = content.replace('--text-main: #183B53;', '--text-main: #16324F;')
content = content.replace('--text-secondary: #4B6F88;', '--text-secondary: #244B6B;')
content = content.replace('--forest-dark: #183B53;', '--forest-dark: #16324F;')

# 2. Replace all remaining hardcoded #183B53 with #16324F
content = content.replace('#183B53', '#16324F')

# 3. Replace all remaining hardcoded #4B6F88 with #244B6B
content = content.replace('#4B6F88', '#244B6B')

# 4. Ensure .card-subtitle has font-weight: 600
content = content.replace(
"""
.card-subtitle {
  font-size: 0.74rem;
  color: var(--text-secondary);
  margin-top: 0.12rem;
}
""".strip(),
"""
.card-subtitle {
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-top: 0.12rem;
}
""".strip()
)

content = content.replace(
"""
.card-subtitle {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
  line-height: 1.45;
}
""".strip(),
"""
.card-subtitle {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-top: 0.2rem;
  line-height: 1.45;
}
""".strip()
)

# 5. Ensure .kpi-method-hint and .kpi-sub-meta have font-weight: 600
content = content.replace(
"""
.kpi-method-hint {
  font-size: 0.68rem;
  color: #244B6B;
}
""".strip(),
"""
.kpi-method-hint {
  font-size: 0.68rem;
  font-weight: 600;
  color: #244B6B;
}
""".strip()
)

content = content.replace(
"""
.kpi-sub-meta {
  font-size: 0.72rem;
  color: #244B6B;
  line-height: 1.35;
}
""".strip(),
"""
.kpi-sub-meta {
  font-size: 0.72rem;
  font-weight: 600;
  color: #244B6B;
  line-height: 1.35;
}
""".strip()
)

with open('css/styles.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated contrast colors in css/styles.css")
