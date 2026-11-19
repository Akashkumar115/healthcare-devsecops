pipeline {
    agent any

    environment {
        IMAGE = "akash7835/healthcare-api"
        DOCKER_CREDS = credentials('dockerhub-creds')
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Secret Scan (Gitleaks)') {
            steps {
                bat 'docker run --rm -v "%WORKSPACE%:/repo" zricethezav/gitleaks:latest detect --source=/repo --no-git --verbose'
            }
        }

        stage('Dependency Scan (npm audit)') {
            steps {
                bat 'npm ci'
                bat 'npm audit --audit-level=high'
            }
        }

        stage('Code Scan (Semgrep)') {
            steps {
                bat 'docker run --rm -v "%WORKSPACE%:/src" semgrep/semgrep semgrep scan --config=auto --error /src/app.js'
            }
        }

        stage('Build Image') {
            steps { bat 'docker build -t %IMAGE%:%BUILD_NUMBER% .' }
        }

        stage('Image Scan (Trivy)') {
            steps {
                bat 'docker run --rm -v //var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL --exit-code 1 %IMAGE%:%BUILD_NUMBER%'
            }
        }

        stage('Push Image') {
            steps {
                bat 'echo %DOCKER_CREDS_PSW%| docker login -u %DOCKER_CREDS_USR% --password-stdin'
                bat 'docker push %IMAGE%:%BUILD_NUMBER%'
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                bat 'kubectl apply -f k8s/deployment.yaml -f k8s/service.yaml -f k8s/networkpolicy.yaml'
                bat 'kubectl set image deployment/healthcare-api api=%IMAGE%:%BUILD_NUMBER%'
                bat 'kubectl rollout status deployment/healthcare-api --timeout=120s'
            }
        }
    }

    post {
        success { echo 'Secure pipeline passed: all scans clean, deployed.' }
        failure { echo 'Pipeline stopped: a security scan or build step failed.' }
    }
}