FROM eclipse-temurin:17-jdk
WORKDIR /app
COPY . /app
RUN ./mvnw -q -DskipTests package
CMD ["java", "-jar", "target/app.jar"]
