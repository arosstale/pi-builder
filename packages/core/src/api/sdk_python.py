"""Pi Builder Python SDK - Client library for Pi Builder API"""
import json
import time
from typing import Any, Dict, List, Optional
from urllib.request import Request, urlopen
from urllib.error import URLError
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Agent:
    """Agent representation"""
    id: str
    name: str
    type: str
    status: str
    capabilities: List[str]


@dataclass
class Task:
    """Task representation"""
    id: str
    name: str
    status: str
    priority: str
    created_at: str
    completed_at: Optional[str] = None


@dataclass
class ApiResponse:
    """API response wrapper"""
    success: bool
    data: Any = None
    error: Optional[str] = None
    timestamp: Optional[str] = None


class PiBuilderSDK:
    """Python SDK for Pi Builder API"""

    def __init__(self, api_url: str, api_key: Optional[str] = None, timeout: int = 30, retries: int = 3):
        """
        Initialize SDK

        Args:
            api_url: Base URL of Pi Builder API
            api_key: Optional API key for authentication
            timeout: Request timeout in seconds
            retries: Number of retries for failed requests
        """
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.retries = retries

    def _request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Any:
        """Make HTTP request to API"""
        url = f"{self.api_url}{path}"
        headers = {
            'Content-Type': 'application/json',
        }

        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'

        body_data = json.dumps(body).encode() if body else None
        last_error = None

        for attempt in range(self.retries):
            try:
                request = Request(url, data=body_data, headers=headers, method=method)
                with urlopen(request, timeout=self.timeout) as response:
                    data = json.loads(response.read().decode())
                    if not data.get('success'):
                        raise ValueError(data.get('error', 'Request failed'))
                    return data.get('data')
            except (URLError, Exception) as e:
                last_error = e
                if attempt < self.retries - 1:
                    delay = (2 ** attempt) * 0.1
                    time.sleep(delay)

        raise last_error or Exception('Request failed')

    # Agent methods
    def list_agents(self) -> List[Agent]:
        """List all agents"""
        data = self._request('GET', '/api/agents')
        return [Agent(**agent) for agent in data or []]

    def get_agent(self, agent_id: str) -> Agent:
        """Get agent by ID"""
        data = self._request('GET', f'/api/agents/{agent_id}')
        return Agent(**data)

    def create_agent(self, name: str, agent_type: str = 'custom', capabilities: Optional[List[str]] = None) -> Agent:
        """Create new agent"""
        body = {
            'name': name,
            'type': agent_type,
            'capabilities': capabilities or [],
        }
        data = self._request('POST', '/api/agents', body)
        return Agent(**data)

    # Task methods
    def list_tasks(self, status: Optional[str] = None, priority: Optional[str] = None) -> List[Task]:
        """List tasks with optional filters"""
        query_params = []
        if status:
            query_params.append(f'status={status}')
        if priority:
            query_params.append(f'priority={priority}')

        path = '/api/tasks'
        if query_params:
            path += '?' + '&'.join(query_params)

        data = self._request('GET', path)
        return [Task(**task) for task in data or []]

    def get_task(self, task_id: str) -> Task:
        """Get task by ID"""
        data = self._request('GET', f'/api/tasks/{task_id}')
        return Task(**data)

    def create_task(self, name: str, priority: str = 'medium') -> Task:
        """Create new task"""
        body = {
            'name': name,
            'priority': priority,
        }
        data = self._request('POST', '/api/tasks', body)
        return Task(**data)

    def update_task(self, task_id: str, status: Optional[str] = None, priority: Optional[str] = None) -> Task:
        """Update task"""
        body = {}
        if status:
            body['status'] = status
        if priority:
            body['priority'] = priority

        data = self._request('PUT', f'/api/tasks/{task_id}', body)
        return Task(**data)

    # Provider methods
    def list_providers(self) -> List[str]:
        """List available providers"""
        data = self._request('GET', '/api/providers')
        return data.get('providers', [])

    # Metrics methods
    def get_metrics(self) -> Dict[str, Any]:
        """Get system metrics"""
        return self._request('GET', '/api/metrics')

    # Health check
    def health(self) -> Dict[str, Any]:
        """Check API health"""
        return self._request('GET', '/health')
