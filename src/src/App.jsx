import ProductList from './components/ProductList.jsx'
import './App.css'

function App() {
  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Catálogo de Productos</h1>
      <ProductList />
    </div>
  )
}

export default App
