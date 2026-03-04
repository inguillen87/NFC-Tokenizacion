# Product decisions v1

## 1. Corporate vs product
- Inmovar corporate no se toca.
- Producto separado.
- Dominio final y naming final se resuelven despues.
- Codigo preparado para renombrarse por config.

## 2. Monorepo, no megarepo improvisado
Se adopta monorepo con apps separadas porque:
- web, dashboard y api tienen ciclos distintos
- cada app puede deployarse a un proyecto diferente en Vercel
- evita mezclar marketing con backend criptografico

## 3. SQL directo en v1
Se conserva Neon + SQL porque:
- ya existe un starter valido
- acelera desarrollo
- la parte sensible es SUN / manifest / activacion, no el ORM

## 4. Auth
La UI de login / register esta como shell.
El wiring real se deja para fase 2.

## 5. Tokenization
No se vende como producto separado en v1.
Se vende como modulo premium de identidad digital.
