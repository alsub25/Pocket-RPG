# Quick Start Guide - Backend Features

## Overview

This guide helps you understand and optionally enable the backend features in Emberwood: The Blackbark Oath.

## Do I Need to Set This Up?

**NO!** The game works perfectly without backend setup:
- ✅ All saves stored locally in your browser
- ✅ No account needed
- ✅ No configuration required
- ✅ Works immediately out of the box

## When Would I Want Backend Features?

Enable backend features if you want:
- ☁️ **Cloud backup** of your game saves
- 🔄 **Sync saves** across multiple devices
- 👤 **User accounts** with secure authentication
- 🔒 **Protected save data** in the cloud

## How to Enable (Optional)

### Step 1: Choose Your Path

**Option A: Use Without Backend (Recommended for Most Users)**
- Do nothing! Just play the game
- All saves stored locally
- Zero setup needed

**Option B: Enable Cloud Features**
1. Read [BACKEND_SETUP.md](BACKEND_SETUP.md) for full instructions
2. Create a free Firebase account
3. Configure Firebase (takes ~10 minutes)
4. Update one configuration file
5. Deploy and enjoy cloud features

### Step 2: For Developers

If you're hosting this game for others:

**Without Backend:**
- Deploy to GitHub Pages
- Users play immediately
- No ongoing costs
- No maintenance

**With Backend:**
- Deploy to GitHub Pages (still static!)
- Set up one Firebase project
- Configure Firestore security rules
- Monitor usage in Firebase Console
- Free tier supports thousands of players

## Features Comparison

| Feature | Without Backend | With Backend |
|---------|----------------|--------------|
| Game saves | ✅ Local only | ✅ Local + Cloud |
| Account system | ❌ | ✅ Email/password |
| Cross-device sync | ❌ | ✅ Yes |
| Save backup | ❌ | ✅ Cloud backup |
| Setup required | ✅ None | ⚙️ ~10 minutes |
| Ongoing cost | ✅ Free | ✅ Free (with limits) |
| Internet required | ❌ | ✅ For cloud sync only |

## Security Notes

**Without Backend:**
- Saves stored in browser localStorage
- Anyone with browser access can view/modify saves
- Clearing browser data loses saves

**With Backend:**
- User accounts protected by Firebase Auth
- Saves encrypted in transit
- Only account owner can access their saves
- Firestore security rules enforce access control

## Getting Help

- **Setup Questions:** See [BACKEND_SETUP.md](BACKEND_SETUP.md)
- **Technical Details:** See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Game Issues:** Open a GitHub issue
- **Firebase Issues:** Check [Firebase Documentation](https://firebase.google.com/docs)

## FAQ

**Q: Will my existing saves work with backend enabled?**  
A: Yes! Local saves continue to work. You can optionally upload them to cloud.

**Q: What happens if Firebase is down?**  
A: Game continues working with local saves. Cloud sync resumes when back online.

**Q: Can I switch between local and cloud saves?**  
A: Yes! You can use both. Cloud saves don't replace local saves.

**Q: Is my data private?**  
A: Yes. Firestore rules ensure only you can access your saves.

**Q: What if I hit the free tier limits?**  
A: Firebase will notify you. You can upgrade or optimize usage.

**Q: Can I self-host the backend?**  
A: The current implementation uses Firebase. Self-hosting would require rewriting the backend services.

## Conclusion

**Most users don't need backend setup.** The game is designed to work perfectly as a static, client-side application. Backend features are a completely optional enhancement for users who want cloud backup and multi-device sync.

**For game developers:** If you're forking this project, you can leave backend disabled and maintain the simple, static deployment model. Or enable it to offer your players cloud features. The choice is yours!
