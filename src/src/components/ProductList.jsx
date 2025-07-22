import { useEffect, useState } from 'react'

const ProductList = () => {
  const [products, setProducts] = useState([])

  useEffect(() => {
    fetch('/inventory.json')
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.error('Error loading inventory', err))
  }, [])

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      {products.map((p) => (
        <div key={p.id} className="border rounded p-2 bg-white shadow">
          <h3 className="font-semibold">{p.modelo}</h3>
          <p className="text-sm text-gray-600">{p.marca}</p>
          <p className="font-bold">${'{'}p.precio{'}'}</p>
        </div>
      ))}
    </div>
  )
}

export default ProductList
