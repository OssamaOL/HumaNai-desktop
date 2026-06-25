# Use the official Nginx alpine image
FROM nginx:alpine

# Remove default configuration
RUN rm /etc/nginx/conf.d/default.conf || true

# Copy our custom configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Set up permissions for non-root execution
RUN chown -R nginx:nginx /var/cache/nginx /etc/nginx /var/log/nginx /var/run && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

# Expose port 8080
EXPOSE 8080

