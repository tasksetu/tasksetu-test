import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Task Manager API",
            version: "1.0.0",
            description: "API documentation for Task Manager",
        },
        servers: [
            {
                url: "http://localhost:5000", // apne server ka url yahan likhein
            },
        ],
    },
    apis: ["./server/routes/*.js"], // yahan apne route files ka path den
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));