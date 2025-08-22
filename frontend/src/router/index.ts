import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import FormsView from '../views/FormsView.vue'
import TestDashboard from '../views/TestDashboard.vue'
import IntegratedTestView from '../views/IntegratedTestView.vue'
import TestExecutionView from '../views/TestExecutionView.vue'
import CreateTestView from '../views/CreateTestView.vue'
import TestReportView from '../views/TestReportView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      redirect: '/test-dashboard'
    },
    {
      path: '/test-dashboard',
      name: 'test-dashboard',
      component: TestDashboard
    },
    {
      path: '/integrated-test',
      name: 'integrated-test',
      component: IntegratedTestView
    },
    {
      path: '/test-execution',
      name: 'test-execution',
      component: TestExecutionView
    },
    {
      path: '/create-test',
      name: 'create-test',
      component: CreateTestView
    },
    {
      path: '/test-report',
      name: 'test-report',
      component: TestReportView
    }
  ]
})

export default router 