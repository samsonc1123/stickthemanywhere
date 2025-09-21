import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Homepage from "@/pages/Homepage";
import ProductDetail from "@/pages/product-detail";
import Products from "@/pages/products";
import Checkout from "@/pages/checkout";
import { Header } from "./components/layout/header";
import { Footer } from "./components/layout/footer";
import { FeaturedKitten } from "./components/layout/featured-kitten";
import UploadForm from './components/UploadForm';
import { ChristianGallery } from './components/ChristianGallery';
import CategoryPage from './pages/category';
import ChristianPage from './pages/christian';
import FloralPage from './pages/floral';
import FloralCategoryPage from './pages/floral-category';
import FloraFaunaPage from './pages/flora-fauna';
import GamingPage from './pages/GamingPage';
import AnimalsPage from './pages/animals';
import MemesPage from './pages/memes';
import SportsPage from './pages/sports';
import MarioPage from './pages/mario';
import AnimePage from './pages/anime';
import KawaiiPage from './pages/kawaii';
import MarijuanaPage from './pages/marijuana';
import TrumpPage from './pages/TrumpPage';
import HispanicPage from './pages/HispanicPage';
import PokemonPage from './pages/PokemonPage';
import CarsPage from './pages/cars';
import MoviesPage from './pages/movies';
import AnimatedSeriesPage from './pages/animatedseries';
import FoodDrinkPage from './pages/FoodDrinkPage';
import TripPage from './pages/TripPage';
import DailyReport from './pages/DailyReport';
import GitHubAdmin from './pages/GitHubAdmin';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Homepage} />
      <Route path="/home" component={Home} />
      <Route path="/products" component={Products} />
      <Route path="/products/:category" component={Products} />
      <Route path="/products/:category/:subcategory" component={Products} />
      <Route path="/product/:id" component={ProductDetail} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/upload" component={UploadForm} />
      <Route path="/gallery" component={ChristianGallery} />
      <Route path="/christian" component={ChristianPage} />
      <Route path="/floral" component={FloralPage} />
      <Route path="/floral-category" component={FloralCategoryPage} />
      <Route path="/flora-fauna" component={FloraFaunaPage} />
      <Route path="/gaming" component={GamingPage} />
      <Route path="/animals" component={AnimalsPage} />
      <Route path="/anime" component={AnimePage} />
      <Route path="/kawaii" component={KawaiiPage} />
      <Route path="/marijuana" component={MarijuanaPage} />
      <Route path="/trump" component={TrumpPage} />
      <Route path="/hispanic" component={HispanicPage} />
      <Route path="/pokemon" component={PokemonPage} />
      <Route path="/cars" component={CarsPage} />
      <Route path="/movies" component={MoviesPage} />
      <Route path="/animatedseries" component={AnimatedSeriesPage} />
      <Route path="/food-drink" component={FoodDrinkPage} />
      <Route path="/trip" component={TripPage} />
      <Route path="/memes" component={MemesPage} />
      <Route path="/sports" component={SportsPage} />
      <Route path="/mario" component={MarioPage} />
      <Route path="/admin/daily-report" component={DailyReport} />
      <Route path="/admin/github" component={GitHubAdmin} />
      <Route path="/category/:category" component={CategoryPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <div className="min-h-screen bg-black">
        <main>
          <Router />
        </main>
      </div>
    </TooltipProvider>
  );
}

export default App;
