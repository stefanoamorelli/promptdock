# Database Conventions

## Schema Design
Follow consistent naming and structure patterns.

```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## Naming Conventions
- Use snake_case for table and column names
- Use descriptive names for foreign keys
- Prefix boolean columns with `is_` or `has_`
- Use plural names for tables

## Migrations
- Always create migrations for schema changes
- Include rollback instructions
- Test migrations on staging before production
- Keep migrations small and focused

## Queries
- Use prepared statements to prevent SQL injection
- Optimize queries with proper indexing
- Avoid N+1 queries with proper eager loading
- Use database-level constraints for data integrity