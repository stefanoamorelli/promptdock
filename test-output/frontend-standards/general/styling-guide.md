# Frontend Styling Guide

## CSS-in-JS Approach
Use styled-components or emotion for component styling.

```tsx
const StyledButton = styled.button<{ variant: 'primary' | 'secondary' }>`
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  background: ${props => props.variant === 'primary' ? '#007bff' : '#6c757d'};
  color: white;
  
  &:hover {
    opacity: 0.9;
  }
`;
```

## Design System
- Follow the established design tokens
- Use consistent spacing (4px, 8px, 16px, 24px, 32px)
- Maintain color palette consistency
- Responsive design with mobile-first approach

## Accessibility
- Always include proper ARIA labels
- Ensure keyboard navigation
- Maintain color contrast ratios
- Use semantic HTML elements