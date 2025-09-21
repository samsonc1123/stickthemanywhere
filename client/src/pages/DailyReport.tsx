import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface DailyReportData {
  date: string;
  summary: {
    totalRevenue: string;
    totalOrders: number;
    totalNewCustomers: number;
    totalStickersToprint: number;
  };
  orders: Array<{
    order: {
      id: string;
      orderNumber: string;
      total: string;
      createdAt: string;
      shippingAddress: any;
    };
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
    items: Array<{
      stickerName: string;
      stickerType: string;
      imageFileName: string;
      quantity: number;
    }>;
  }>;
  newCustomers: Array<{
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
  }>;
  stickersToprint: Array<{
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    stickerName: string;
    stickerType: string;
    imageFileName: string;
    quantity: number;
    shippingAddress: any;
  }>;
}

export default function DailyReport() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const { data: reportData, isLoading } = useQuery<DailyReportData>({
    queryKey: ['/api/admin/daily-report', selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/admin/daily-report?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch daily report');
      return response.json();
    }
  });

  const { data: inventoryCount } = useQuery({
    queryKey: ['/api/inventory/count'],
    queryFn: async () => {
      const response = await fetch('/api/inventory/count');
      if (!response.ok) throw new Error('Failed to fetch inventory');
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-purple-400">Loading Daily Report...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-purple-400">Daily Business Report</h1>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-gray-800 border border-purple-500 rounded px-3 py-2 text-white"
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Total Revenue</h3>
            <p className="text-3xl font-bold">${reportData?.summary.totalRevenue || '0.00'}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Orders</h3>
            <p className="text-3xl font-bold">{reportData?.summary.totalOrders || 0}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">New Customers</h3>
            <p className="text-3xl font-bold">{reportData?.summary.totalNewCustomers || 0}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Stickers to Print</h3>
            <p className="text-3xl font-bold">{reportData?.summary.totalStickersToprint || 0}</p>
          </div>
        </div>

        {/* Current Inventory Status */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4 text-pink-400">Current Inventory Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {inventoryCount?.map((box: any, index: number) => (
              <div key={index} className="bg-gray-700 rounded p-4">
                <h3 className="font-semibold text-cyan-400">
                  Box {box.boxPosition}: {box.subcategoryName}
                </h3>
                <p className="text-2xl font-bold text-white">{box.count} stickers</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stickers to Print Today */}
        {reportData?.stickersToprint && reportData.stickersToprint.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-pink-400">Stickers to Print Today</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="py-2 px-4">Order #</th>
                    <th className="py-2 px-4">Customer</th>
                    <th className="py-2 px-4">Sticker</th>
                    <th className="py-2 px-4">Type</th>
                    <th className="py-2 px-4">Quantity</th>
                    <th className="py-2 px-4">Image File</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.stickersToprint.map((item, index) => (
                    <tr key={index} className="border-b border-gray-700">
                      <td className="py-2 px-4 text-cyan-400">{item.orderNumber}</td>
                      <td className="py-2 px-4">{item.customerName}</td>
                      <td className="py-2 px-4">{item.stickerName}</td>
                      <td className="py-2 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.stickerType === 'static_pvc' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-blue-600 text-white'
                        }`}>
                          {item.stickerType === 'static_pvc' ? 'Static PVC' : 'Laminated Vinyl'}
                        </span>
                      </td>
                      <td className="py-2 px-4 font-bold">{item.quantity}</td>
                      <td className="py-2 px-4 text-xs text-gray-400">{item.imageFileName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Today's Orders */}
        {reportData?.orders && reportData.orders.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-pink-400">Today's Orders</h2>
            <div className="space-y-4">
              {reportData.orders.map((orderGroup, index) => (
                <div key={index} className="bg-gray-700 rounded p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-cyan-400">
                        Order #{orderGroup.order.orderNumber}
                      </h3>
                      <p className="text-gray-300">
                        {orderGroup.user.firstName} {orderGroup.user.lastName} - {orderGroup.user.email}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold">${orderGroup.order.total}</p>
                      <p className="text-gray-400 text-sm">
                        {new Date(orderGroup.order.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-gray-600 pt-2">
                    <h4 className="text-sm font-semibold mb-2">Items:</h4>
                    <ul className="text-sm space-y-1">
                      {orderGroup.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex justify-between">
                          <span>{item.stickerName}</span>
                          <span>Qty: {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Customers Today */}
        {reportData?.newCustomers && reportData.newCustomers.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-pink-400">New Customers Today</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportData.newCustomers.map((customer, index) => (
                <div key={index} className="bg-gray-700 rounded p-4">
                  <h3 className="font-semibold text-cyan-400">
                    {customer.firstName} {customer.lastName}
                  </h3>
                  <p className="text-gray-300">{customer.email}</p>
                  <p className="text-gray-400 text-sm">
                    Registered: {new Date(customer.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {reportData && reportData.orders.length === 0 && reportData.newCustomers.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-400 mb-2">No Activity Today</h2>
            <p className="text-gray-500">No orders or new customers for {selectedDate}</p>
          </div>
        )}
      </div>
    </div>
  );
}