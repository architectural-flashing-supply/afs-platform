import { redirect } from 'next/navigation';

export default function EmployeeHomePage() {
  redirect('/employee/orders');
}
