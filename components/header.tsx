import { Button } from "./ui/button";
import { Link, LogInIcon } from "lucide-react";

export default function Header() {
    return(
        <div className="flex justify-between mr-4">
            <p>Join in and vote for next question to be added t the trend watch</p>
            
            <Link href="/auth/login">
                <Button variant="outline">
                    <LogInIcon className="w-4 h-4" />
                    Login
                </Button>
            </Link>
        </div>
    )
}