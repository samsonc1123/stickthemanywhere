import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollRestoration from "./components/ScrollRestoration";
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
import CategoryPage from './pages/category';
import ChristianPage from './pages/christian';
import FloralPage from './pages/floral';
import FloralCategoryPage from './pages/floral-category';
import FloraFaunaPage from './pages/flora-fauna';
import GamingPage from './pages/GamingPage';
import AnimalsPage from './pages/animals';
import FlowersPage from './pages/FlowersPage';
import MemesPage from './pages/memes';
import SportsPage from './pages/sports';
import MarioPage from './pages/mario';
import AnimePage from './pages/anime';
import KawaiiPage from './pages/kawaii';
import MarijuanaPage from './pages/marijuana';
import TrumpPage from './pages/TrumpPage';
import HispanicPage from './pages/HispanicPage';
import PokemonPage from './pages/PokemonPage';
import PokemonTypesPage from './pages/PokemonTypesPage';
import PokemonSubcategoryPage from './pages/PokemonSubcategoryPage';
import PokemonTypeStickersPage from './pages/PokemonTypeStickersPage';
import PokemonGenerationStickersPage from './pages/PokemonGenerationStickersPage';
import PokemonLegendaryStickersPage from './pages/PokemonLegendaryStickersPage';
import HelloKittyPage from './pages/HelloKittyPage';
import CarsPage from './pages/cars';
import MoviesPage from './pages/movies';
import MovieFranchisePage from './pages/MovieFranchisePage';
import AnimatedSeriesPage from './pages/animatedseries';
import FoodDrinkPage from './pages/FoodDrinkPage';
import TripPage from './pages/TripPage';
import DisneyPage from './pages/DisneyPage';
import UnicornsPage from './pages/UnicornsPage';
import DragonsPage from './pages/DragonsPage';
import FashionPage from './pages/FashionPage';
import MusicianPage from './pages/MusicianPage';
import DailyReport from './pages/DailyReport';
import GitHubAdmin from './pages/GitHubAdmin';
import StickerList from './components/StickerList';
import AdminUploader from './pages/AdminUploader';
import AdminReorder from './pages/AdminReorder';
import AdminPage from './pages/AdminPage';
import AdminPrefixMapper from './pages/AdminPrefixMapper';
import AdminDiagnostics from './pages/AdminDiagnostics';
import AdminTaxonomy from './pages/AdminTaxonomy';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Homepage} />
      <Route path="/home" component={Home} />
      <Route path="/pr=oducts" component={Products} />
      <Route path="/products/:category" component={Products} />
      <Route path="/products/:category/:subcategory" component={Products} />
      <Route path="/product/:id" component={ProductDetail} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/upload" component={UploadForm} />
      <Route path="/christian" component={ChristianPage} />
      <Route path="/floral" component={FloralPage} />
      <Route path="/floral-category" component={FloralCategoryPage} />
      <Route path="/flora-fauna" component={FloraFaunaPage} />
      <Route path="/gaming" component={GamingPage} />
      <Route path="/animals" component={AnimalsPage} />
      <Route path="/flowers" component={FlowersPage} />
      <Route path="/anime" component={AnimePage} />
      <Route path="/kawaii" component={KawaiiPage} />
      <Route path="/marijuana" component={MarijuanaPage} />
      <Route path="/trump" component={TrumpPage} />
      <Route path="/hispanic" component={HispanicPage} />
      <Route path="/pokemon" component={PokemonPage} />
      <Route path="/pokemon/types" component={PokemonTypesPage} />
      <Route path="/pokemon/:subcategory" component={PokemonSubcategoryPage} />
      <Route path="/pokemon/type/:type" component={PokemonTypeStickersPage} />
      <Route path="/pokemon/generation/:gen" component={PokemonGenerationStickersPage} />
      <Route path="/pokemon/legendaries/all" component={PokemonLegendaryStickersPage} />
      <Route path="/hellokitty" component={HelloKittyPage} />
      <Route path="/cars" component={CarsPage} />
      <Route path="/movies" component={MoviesPage} />
      <Route path="/movies/:franchiseCode" component={MovieFranchisePage} />
      <Route path="/animatedseries" component={AnimatedSeriesPage} />
      <Route path="/food-drink" component={FoodDrinkPage} />
      <Route path="/trip" component={TripPage} />
      <Route path="/disney" component={DisneyPage} />
      <Route path="/unicorns" component={UnicornsPage} />
      <Route path="/dragons" component={DragonsPage} />
      <Route path="/fashion" component={FashionPage} />
      <Route path="/musicians" component={MusicianPage} />
      <Route path="/memes" component={MemesPage} />
      <Route path="/sports" component={SportsPage} />
      <Route path="/mario" component={MarioPage} />
      <Route path="/admin/daily-report" component={DailyReport} />
      <Route path="/admin/github" component={GitHubAdmin} />
      <Route path="/admin/uploader" component={AdminUploader} />
      <Route path="/admin/reorder" component={AdminReorder} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/admin/prefix-mapper" component={AdminPrefixMapper} />
      <Route path="/admin/diagnostics" component={AdminDiagnostics} />
      <Route path="/admin/taxonomy" component={AdminTaxonomy} />
      <Route path="/category/:category" component={CategoryPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <ScrollRestoration />
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
