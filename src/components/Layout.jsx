import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import StayUpdated from './StayUpdated';

export default function Layout({ showStayUpdated = true }) {
  return (
    <>
      <Header />
      <Outlet />
      {showStayUpdated && <StayUpdated />}
      <Footer />
    </>
  );
}
