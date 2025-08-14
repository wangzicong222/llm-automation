import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import FormsView from '../views/FormsView.vue'
import TestDashboard from '../views/TestDashboard.vue'
import IntegratedTestView from '../views/IntegratedTestView.vue'
import TestExecutionView from '../views/TestExecutionView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView
    },
    {
      path: '/forms',
      name: 'forms',
      component: FormsView
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
    }
  ]
})

export default router 