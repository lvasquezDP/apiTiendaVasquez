# Rest Project + TypeScript

Este proyecto previamente inicializado tiene todo lo necesario para trabajar con TypeScript, Express y Rest.

## Instalación

1. Clonar .env.template a .env y configurar las variables de entorno
2. Ejecutar `npm install` para instalar las dependencias
3. En caso de necesitar base de datos, configurar el docker-compose.yml y ejecutar `docker-compose up -d` para levantar los servicios deseados.
4. Ejecutar `npx prisma migrate dev --name redSas` para generar base de datos
5. Ejecutar `npx prisma generate` para generar el cliente de prisma
6. Ejecutar `npm run dev` para levantar el proyecto en modo desarrollo