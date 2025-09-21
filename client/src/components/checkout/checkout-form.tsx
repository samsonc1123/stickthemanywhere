import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "wouter";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";

const checkoutFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  address: z.string().min(5, { message: "Address must be at least 5 characters" }),
  city: z.string().min(2, { message: "City must be at least 2 characters" }),
  postalCode: z.string().min(4, { message: "Postal code must be at least 4 characters" }),
  country: z.string().min(2, { message: "Country must be at least 2 characters" }),
});

type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

export function CheckoutForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { cart, clearCart, total } = useCart();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      name: "",
      email: "",
      address: "",
      city: "",
      postalCode: "",
      country: "",
    },
  });

  const onSubmit = (data: CheckoutFormValues) => {
    setIsSubmitting(true);
    
    // Simulate checkout process
    setTimeout(() => {
      toast({
        title: "Order placed successfully!",
        description: "Thank you for your purchase! Your stickers will be on their way soon.",
      });
      
      clearCart();
      setLocation("/");
    }, 1500);
  };

  return (
    <div className="bg-dark-gray rounded-xl p-6 neon-border-blue">
      <h2 className="text-2xl font-bold text-white mb-6">Checkout Information</h2>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Full Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="John Doe" 
                      className="bg-light-gray text-white border-0"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Email</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="john@example.com" 
                      className="bg-light-gray text-white border-0"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">Address</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="123 Neon Street" 
                    className="bg-light-gray text-white border-0"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">City</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Glow City" 
                      className="bg-light-gray text-white border-0"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Postal Code</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="12345" 
                      className="bg-light-gray text-white border-0"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Country</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Neon Land" 
                      className="bg-light-gray text-white border-0"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="flex justify-between text-white mb-2">
              <span>Subtotal</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white mb-2">
              <span>Shipping</span>
              <span>$5.00</span>
            </div>
            <div className="flex justify-between text-white text-lg font-bold mt-4">
              <span>Total</span>
              <span className="text-neon-pink text-glow-pink">${(total + 5).toFixed(2)}</span>
            </div>
          </div>
          
          <div className="flex flex-col space-y-3 mt-6">
            <Button 
              type="submit"
              className="bg-neon-pink hover:bg-opacity-80 text-white font-bold py-3 rounded-lg neon-button shadow-neon-pink"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Processing..." : "Complete Purchase"}
            </Button>
            
            <Link href="/">
              <Button 
                type="button"
                variant="outline"
                className="border-neon-blue text-neon-blue hover:bg-neon-blue hover:bg-opacity-10"
              >
                Continue Shopping
              </Button>
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
