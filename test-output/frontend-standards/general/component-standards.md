# React Component Standards

## Functional Components
Always use functional components with hooks instead of class components.

```tsx
export const MyComponent: React.FC<Props> = ({ title, onClick }) => {
  const [count, setCount] = useState(0);
  
  return (
    <button onClick={onClick}>
      {title}: {count}
    </button>
  );
};
```

## TypeScript Integration
- Always define proper interfaces for props
- Use strict typing, avoid `any`
- Leverage union types for variants

## State Management
- Use `useState` for local state
- Use `useReducer` for complex state logic
- Consider context for shared state

## Testing
- Write tests for all components
- Use React Testing Library
- Test user interactions, not implementation details